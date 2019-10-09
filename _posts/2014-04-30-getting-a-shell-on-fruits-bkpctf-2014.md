---
layout: post
title: "Getting a shell on fruits - bkpctf 2014"
author: wapiflapi
tags:
- bkpctf
- CTF
- 2k14
- writeup
- gdb
- exploit
---

Long time no see! I just spent two days exploiting a CTF challenge and people
want me to do a writeup so here we go. Full sploit can be found here:
[http://pastebin.com/0px8FEJ7](http://pastebin.com/0px8FEJ7)

The binary we will be looking at is _fruits_ from Boston Key Party CTF 2014,
thanks guys! It can be found here:
[pastebin.com/n4Z9Vw4A](http://pastebin.com/n4Z9Vw4A)

> fruits: ELF 64-bit, uses shared libs, for GNU/Linux 2.6.24, stripped
> Canary found NX enabled PIE enabled

Ok, about every protection we can think of is activated but also we don't just
want to read the key file. No, we want a shell. Why? Because of some guy named
palkeo who challenged me and will now buy me a beer some day.


## About fruits

fruits is a server listening on 37717, it forks a process
for each client who can then order apples and pears and leave some notes. Here
is the menu we get when connecting to the server:

    Welcome to our store's shopping cart!

    ========================================
    Cart is empty.

    Main Menu:
      [0]: Submit Order
      [1]: List Notes
      [2]: Add a Note
      [3]: Change a Note
      [4]: Read note from file
      [5]: Delete a Note
      [6]: Add an Item to your Cart
      [7]: Change Item Quantity
      [8]: Delete Item from cart
      [9]: Set favorite item
      [10]: Change fav item
      [11]: Print favorite item
    Choose an option:

First lets do a quick overview of all the features:

#### Submit Order

Tells us our order has been placed, doesn't seem to actually do anything at
all.

#### List Notes, Add a Note, Change a Note, Read note from file, Delete a Note

Those are pretty self explanatory, we have the ability to add, change and delete
notes. We can see the notes we added with option 2. Option 3 tells us we can't
read a note from a file because we're not admin. Since this is a CTF exercise,
this kind of option hints to the fact that there probably is a key in some file
cleverly named _key_ or _flag_. We shouldn't focus on getting code execution too
much because bypassing this admin check is probably enough, especially since
this is 100pts.

#### Add an Item to your Cart, Change Item Quantity, Delete Item from cart

This second set of features allows us to do the shopping. There are two kind of
objects we can buy, apples and pears. Each time we add an _item_ to our cart it
adds an entry to the cart. When we change the quantity of an item it changes the
quantity for that entry, not the total amount of apples or pears we have in our
cart. We can have: 1 apple + 2 pears + 3 apples + 4 pears, this would be four
items.

#### Set favorite item, Change fav item, Print favorite item

This is **not** self explanatory! First, remember an item is an entry in the
cart, not apples or pears. But the most counter-intuitive (to me at least) is
the fact that option 10, *Change fav item*, doesn't change which entry is your
favorite item but instead it **changes the item itself** to become apples or
pears according to what you select. The last option prints the type of our
favorite item.


# Solving the CTF Task

After some testing we quickly find a vulnerability. If the favorite item is
deleted a use after free seems to be triggered when we try to print the
favorite item because the server crashes.

Crashing is definitively not what we want so lets not print our favorite item
just yet. Instead lets see if we can play with that memory somehow before it
crashes.

There seem to be two kind of objects in this program, items and notes. If we
add a new item it will probably end up in the spot of the old one. The problem
is from the server's point of view everything will be normal again because the
favorite item is indeed an item. Lets play with the notes instead. In order to
use the freed memory it should be about the size of an item, this can be
reversed engineered or simply guessed using trial and error.

Lets assume our new note took the place of the deleted item, now what? We just
filled that memory with "a"s and printing the favorite items still crashes
(why wouldn't it?).

## Defeating PIE

Since we have full ASLR & PIE, our priority should be leaking some stuff to get
an idea of what is going on. We have this note filled with "a"s that's at the
same time our favorite item. How could we convince the server to write some
address to it? The only actions that change items are changing its quantity or
changing its type (which is possible since its our favorite.)

Lets try the later, those are the actions we take:

    [6]: Add an Item to your Cart
    [9]: Set favorite item
    [8]: Delete Item from cart     // Now the favorite item is freed.
    [2]: Add a Note                // The note uses the freed memory.
    [10]: Change fav item          // This writes to our note :-)
    [1]: List Notes

Or `6 0 9 0 8 0 2 aaaaaaaaaaaaaaaa 10 0 1` for short, this is what I get:

    Notes (1):
    #0: Pé"^

Looks like a leak to me. We just need to figure out what exactly is leaked.
For this we have two options. a) We can disassemble the binary and check what
exactly is touched when we change an item's type. b) We can take the address
and check what it points to at runtime in gdb.

Under gdb the leaked address I get is 0x0000555555757d90.

    0000| 0x555555757d90 --> 0x555555556400 (lea rax,[rip+0x133])

Apparently that's the address of a function pointer. This address points
somewhere in the program which means we just defeated PIE. On linux ASLR
randomizes mmap's base address, but doesn't re-randomize between each subsequent
call to it. That means in theory leaking the address of the binary is enough to
compute the addresses for the heap & libc. But I didn't know that three days ago
and it doesn't work very well on this binary anyway, so lets not assume this.

## Reading a file

Changing the favorite item's type restored a pointer. Lets check if that fixed
the crash when we print it.

    Choose an option:11
    Your favorite item is a Pear

It does! That means this pointer is used, if we can set the pointer to the
address of something useful then we're done. We still haven't done a lot of
reversing or studied how the memory is handled, but we need to be able to set
that pointer to what we want. The first thing that comes to mind is simply
changing the note to something else and checking if printing the favorite item
starts crashing again. If it does then we are able to write back to the pointer
after it has leaked by modifying the note. (We could also start all over again
because this is a forking server and the addresses should always be the same,
but that's no fun!) Remember the goal is probably to read a file, so lets take
a look at the code for Read note from file. The main loop of the binary looks
like this:

[![](http://2.bp.blogspot.com/-IXPf9bbHKxQ/U2BbctvgD5I/AAAAAAAAAFs/hw660q-bS1U/s1600/snapshot.png)](http://2.bp.blogspot.com/-IXPf9bbHKxQ/U2BbctvgD5I/AAAAAAAAAFs/hw660q-bS1U/s1600/snapshot.png)

If we use option 4 a check is performed before calling the function from an
array of function pointers. Function pointers? Cool that's exactly what we need:
The known address of the address of a piece of code. We need the offset between
the leaked pointer and the address of the function pointer for option 4.

According to IDA, the array of function pointers (rbx in the above diagram), is
at `off_203CA0`, which means the fourth pointer is at `off_203CC0`. Under gdb
the leaked address was `0x0000555555757d90` and the program is mapped at
`0x0000555555554000`.

0x0000555555554000 + 0x203CC0 - 0x0000555555757d90 = **-0xd0**

Anyway, long story short: That works.

# Now how do we pop a shell?

## Recon

Now we have a basic understanding of the vulnerability, that's enough to
ret2text and trigger the read file. But if we are going to pop a shell we'll
need more than that. Lets start by examining where exactly the pointer we
control is used. So far we know its a pointer to a function that is called,
but that's all we know.

[![](http://2.bp.blogspot.com/-I2pcaL8t0d0/U2EFQTipRtI/AAAAAAAAAGQ/EClJNREGMiA/s1600/snapshot.png)](http://2.bp.blogspot.com/-I2pcaL8t0d0/U2EFQTipRtI/AAAAAAAAAGQ/EClJNREGMiA/s1600/snapshot.png)

Since the crashes where caused when triggering the print favorite item option,
that's a good place to start looking. We can see a pointer to the favorite item
was stored and is now loaded into rdi. The first 8 bytes of an item seem to
contain the address of a function that returns its name, "apple" or "pear".
That's consistent with what we experienced when blindly setting a function
pointer and hopping it would be called during the CTF. `print_fav` doesn't touch
any registers except for `rdi` and `rax`, maybe `rsi` or others contain
something useful. The following is a dump of what we get when setting
`"BBBBBBBB"` as the first bytes of our note/favorite item. We get a crash when
we attempt to `call [rax]`.

[![](http://1.bp.blogspot.com/-FHrjp9iq5B0/U2EOg5zPtGI/AAAAAAAAAG8/SZKu31yfXWM/s1600/snapshot.png)](http://1.bp.blogspot.com/-FHrjp9iq5B0/U2EOg5zPtGI/AAAAAAAAAG8/SZKu31yfXWM/s1600/snapshot.png)

[![](http://4.bp.blogspot.com/-C1Js1Y_8uDw/U2EOqkbklFI/AAAAAAAAAHE/avyxI59xavY/s1600/snapshot.png)](http://4.bp.blogspot.com/-C1Js1Y_8uDw/U2EOqkbklFI/AAAAAAAAAHE/avyxI59xavY/s1600/snapshot.png)

As expected, `rdi` points to the favorite item and `rax` contains the address
loaded from the beginning of the item during the previous instruction. The other
registers couldn't be less helpful. `rsi`, `rdx` and `rcx` which are the other
arguments to the call contain garbage that we can't control, and the other
registers have some pointers to code. What about the stack?

[![](http://2.bp.blogspot.com/-qGgR7jTdS3k/U2EOTHnmFiI/AAAAAAAAAG0/IYntKU76GZk/s1600/snapshot.png)](http://2.bp.blogspot.com/-qGgR7jTdS3k/U2EOTHnmFiI/AAAAAAAAAG0/IYntKU76GZk/s1600/snapshot.png)

Wow that's empty. `0x555555556375` is the return address into the main loop we
saw earlier, and then we already have main's stack frame. Nothing we control at
all. Bad luck.

## OK, what do we have?
    0x555555555960: mov    rax,QWORD PTR [rdi]
    0x555555555963: call   QWORD PTR [rax]

The *only* thing we control is the memory `rdi` points to, we control that on
63 bytes given we don't use null-bytes or new-lines otherwise it will be cut.
We do not have any other registers or the stack to work with. On the plus
side: we did leak an address and bypass PIE.

What can we do with this? Not much, the only thing we can do is call code
pointed to by an address stored at a know location in memory, that is to say
in the binary itself. Think function pointers, vtables, GOT, etc...
Can we have a list? Of course. Here you go:

    0x555555758010 --> 0x7ffff7df04e0 (sub    rsp,0x38)
    0x555555758018 --> 0x7ffff7a97c30 (<free>)
    0x555555758020 --> 0x7ffff7b104e0 (<setsockopt>)
    0x555555758028 --> 0x5555555551d6 (<inet_ntoa@plt+6>)
    0x555555758030 --> 0x5555555551e6 (<fclose@plt+6>)
    0x555555758038 --> 0x5555555551f6 (<__stack_chk_fail@plt+6>)
    0x555555758040 --> 0x7ffff7a9bc90 (movd   xmm1,esi)
    0x555555758048 --> 0x7ffff7a86940 (<getc>)
    0x555555758050 --> 0x7ffff7b00de0 (<close>)
    0x555555758058 --> 0x7ffff7a86350 (<fputc>)
    0x555555758060 --> 0x7ffff7a35dd0 (<__libc_start_main>)
    0x555555758068 --> 0x555555555256 (<fgets@plt+6>)
    0x555555758070 --> 0x555555555266 (<feof@plt+6>)
    0x555555758078 --> 0x555555555276 (<__gmon_start__@plt+6>)
    0x555555758080 --> 0x7ffff7a97590 (<malloc>)
    0x555555758088 --> 0x7ffff7a82d20 (<fflush>)
    0x555555758090 --> 0x7ffff7b101d0 (<listen>)
    0x555555758098 --> 0x7ffff7a71a80 (<sscanf>)
    0x5555557580a0 --> 0x7ffff7a97d30 (<realloc>)
    0x5555557580a8 --> 0x7ffff7a82a70 (<fdopen>)
    0x5555557580b0 --> 0x5555555552e6 (<__printf_chk@plt+6>)
    0x5555557580b8 --> 0x7ffff7b100b0 (<bind>)
    0x5555557580c0 --> 0x555555555306 (<memmove@plt+6>)
    0x5555557580c8 --> 0x555555555316 (<fopen@plt+6>)
    0x5555557580d0 --> 0x7ffff7b10050 (<accept>)
    0x5555557580d8 --> 0x555555555336 (<exit@plt+6>)
    0x5555557580e0 --> 0x7ffff7a83bc0 (<fwrite>)
    0x5555557580e8 --> 0x7ffff7b1e300 (<__fprintf_chk>)
    0x5555557580f0 --> 0x7ffff7a9d660 (<strdup>)
    0x5555557580f8 --> 0x555555555376 (<__cxa_finalize@plt+6>)
    0x555555758100 --> 0x7ffff7ad5db0 (<fork>)
    0x555555758108 --> 0x7ffff7b10540 (<socket>)

There are also a bunch of pointers to code contained in the binary (other than
the PLT included in the list above) but the binary doesn't contain anything
obviously useful to us so I didn't include those.

That's everything we have. Now we need to start thinking about what we can do
with this.

## Expanding

None of the functions above will spawn us a shell, especially since we only
control the first argument, and in a very limited way: The first argument points
to memory starting with the address of the code being called, that will very
likely mess things up. Even if we had a known pointer to `system` the null bytes
in the address would cut the command before anything useful. As none of the
above functions work out of the box we'll need to find a way to call something
else. To do this we'll have to put a pointer to what we want at a known location
in memory. The only place where we can reasonably write is on the heap, using
notes. For our note on the heap to be a known address we'dd have to leak it
first. That's our first goal.

### Leaking a heap address

Lets look at our list of callable functions again. Given the first argument is a
pointer to our note, how can we leak the heap? We're lucky this time. The first
function gives us a solution: `free`. If we call `free` libc's malloc will
reclaim the space used by the note and write some pointers to it for
bookkeeping. Because the program doesn't know we freed the note behind its back
we'll still be able to list the notes and leak the pointer. You might want to
add a second note after this, then you'll have note0 and note1 using the same
memory, the memory that's also used by the favorite item. If you don't do this
the next allocation from libc or whatever will mess with you.

### Getting libc

OK, we're now able to call any address we want using a trampoline because we can
compute the heap addresses of our notes. There isn't a silly call to random
anywhere in dlmalloc's implementation. But that still limits us to calling code
contained in the binary and their aren't a lot of useful gadgets to ROP with.
There is a nice trick here, remember the way to solve the challenge by simply
reading the flag.txt file? Well we can do the same with `/proc/self/maps`, a
note is limited to 63 characters, but luckily libc will always be the first
mapping, except under gdb. We leaked addresses for the heap and libc, we're
making progress: **ASLR is defeated**. (Actually not quite, because we still
don't know the stack, but whatever!)  We can call any piece of code we want
now. But still, we don't control the registers as much as we'd like.

## Control

Now that we have knowledge of where the heap and libc are located in memory it
is time to start thinking about an actual exploit. We can call any piece of code
we want and we control parts of the memory pointed to by rdi. What can we call?
Well that's a good question, I spent hours on this trying to find a good
gadget. After a while I stumbled upon some code from setcontext. I you don't
know what setcontext is then go read the man page, **now**. This gadget is
pretty amazing:

    <setcontext+53>:  mov    rsp, QWORD PTR [rdi+0xa0]
    <setcontext+60>:  mov    rbx, QWORD PTR [rdi+0x80]
    <setcontext+67>:  mov    rbp, QWORD PTR [rdi+0x78]
    <setcontext+71>:  mov    r12, QWORD PTR [rdi+0x48]
    <setcontext+75>:  mov    r13, QWORD PTR [rdi+0x50]
    <setcontext+79>:  mov    r14, QWORD PTR [rdi+0x58]
    <setcontext+83>:  mov    r15, QWORD PTR [rdi+0x60]
    <setcontext+87>:  mov    rcx, QWORD PTR [rdi+0xa8]
    <setcontext+94>:  push   rcx
    <setcontext+95>;  mov    rsi, QWORD PTR [rdi+0x70]
    <setcontext+99>;  mov    rdx, QWORD PTR [rdi+0x88]
    <setcontext+106>: mov    rcx, QWORD PTR [rdi+0x98]
    <setcontext+113>: mov    r8,  QWORD PTR [rdi+0x28]
    <setcontext+117>: mov    r9,  QWORD PTR [rdi+0x30]
    <setcontext+121>: mov    rdi, QWORD PTR [rdi+0x68]
    <setcontext+125>: xor    eax, eax
    <setcontext+127>: ret

All registers, including `rsp` and `rbp`, are loaded from the memory pointed to
by `rdi` and we control where we ret to.

The problem is the offsets, they are pretty large, and we only control 63 bytes
through our notes. We'll have to setup the heap in such a way that we have the
values we want where we want them. There might be a correct way to do this, I
don't know. The way I did it is simple: I just played around with different
allocation patterns until I found something that seemed to work OK.

I started by doing a simple loop. Adding some notes so that I could see what a
heap looked like. This is what I got, dumping from rdi, our favorite note:

    0000| 0x555555759490 --> 0x555555757cc0 --> 0x555555555a90 (push   rbx)
    0008| 0x555555759498 ('o' <repeats 15 times>)
    0016| 0x5555557594a0 --> 0x6f6f6f6f6f6f6f ('ooooooo')
    0024| 0x5555557594a8 --> 0x21 ('!')
    0032| 0x5555557594b0 ("11111111")
    0040| 0x5555557594b8 --> 0x555555759400 --> 0x0
    0048| 0x5555557594c0 --> 0x555555759520 ("00000000")
    0056| 0x5555557594c8 --> 0x51 ('Q')
    0064| 0x5555557594d0 --> 0x0
    0072| 0x5555557594d8 --> 0x555555759490 --> 0x555555757cc0 --> 0x555555555a90 (push   rbx)
    0080| 0x5555557594e0 --> 0x555555759520 ("00000000")
    0088| 0x5555557594e8 --> 0x5555557594b0 ("11111111")
    0096| 0x5555557594f0 --> 0x555555759570 ("22222222")
    0104| 0x5555557594f8 --> 0x5555557595d0 ("33333333")
    0112| 0x555555759500 --> 0x5555557595f0 ("44444444")
    0120| 0x555555759508 --> 0x555555759610 ("55555555")
    0128| 0x555555759510 --> 0x555555759630 ("66666666")
    0136| 0x555555759518 --> 0x21 ('!')
    0144| 0x555555759520 ("00000000")
    0152| 0x555555759528 --> 0x0
    0160| 0x555555759530 --> 0x0
    0168| 0x555555759538 --> 0x31 ('1')
    0176| 0x555555759540 --> 0x0
    0184| 0x555555759548 --> 0x555555759490 --> 0x555555757cc0 --> 0x555555555a90 (push   rbx)
    0192| 0x555555759550 --> 0x555555759520 ("00000000")
    0200| 0x555555759558 --> 0x5555557594b0 ("11111111")
    0208| 0x555555759560 --> 0x555555759570 ("22222222")
    0216| 0x555555759568 --> 0x21 ('!')
    0224| 0x555555759570 ("22222222")
    0232| 0x555555759578 --> 0x555555759500 --> 0x5555557595f0 ("44444444")
    0240| 0x555555759580 --> 0xffffffffffffffff
    0248| 0x555555759588 --> 0x41 ('A')
    0256| 0x555555759590 --> 0x0
    0264| 0x555555759598 --> 0x555555759490 --> 0x555555757cc0 --> 0x555555555a90 (push   rbx)
    0272| 0x5555557595a0 --> 0x555555759520 ("00000000")
    0280| 0x5555557595a8 --> 0x5555557594b0 ("11111111")
    0288| 0x5555557595b0 --> 0x555555759570 ("22222222")
    0296| 0x5555557595b8 --> 0x5555557595d0 ("33333333")
    0304| 0x5555557595c0 --> 0x5555557595f0 ("44444444")
    0312| 0x5555557595c8 --> 0x21 ('!')
    0320| 0x5555557595d0 ("33333333")

That's a lot of copy/pasta, but its necessary to show you the patterns.  For
this test I added 8 notes: `"00000000"` to `"77777777"`, so not everything is
included in this dump obviously. There are two things to note in this dump,
first we have the raw notes at offsets 0, 32, 144, 224 and 320. The other thing
we have are the lists of pointers to our notes at offsets 72, 184 and
264. If you look carefully you'll see it always start with our note0 (the one
that we use to trigger use after frees) and then continues sequentially with the
other notes we add. However they don't all stop with the same note. This "list"
is actually an array that the program uses to keep track of all the notes. It is
reallocated every time a note is added or delete, that's why its at several
places.

Now, what we need before jumping into setcontext is a little bit different. If
you look back at the way the registers are loaded we notice we can jump after
the moment `rsp` is loaded and avoid changing our stack if we want to. The one
location we MUST control is `rdi + 0xa8` because that contains the address we will
`ret` to.

Basically we have two options. We can control `rsp` and `ret`'s target and do a
ropchain. But that's pretty hard to pull off because those two are loaded from
consecutive addresses. Due to the null bytes we can't simply write both of them
in the same note. The second option is to control `rdi` and `ret`'s target and
call system with a controlled argument. That sounds way easier to do.

We're almost there. If we manage to put the address of a payload at `rdi + 0x68`
and the address of system at `rdi + 0xa8` it's a win. But that took (me) a long
time, I didn't really know what I was doing and I had no experience with heap
spraying. Finally the following routine worked out OK:

  1. Add a bunch of notes with the address of system
  2. Delete those notes in order to empty the array
  3. Add a bunch of notes with a payload, the array will fill with pointers to it.

The payload notes should have a different size than the system ones, otherwise
they will end up overwriting our pointers.

[![](http://2.bp.blogspot.com/-1ZHSGrcDBNM/U2Fpa741amI/AAAAAAAAAHU/9FYwwi9vzgI/s1600/snapshot.png)](http://2.bp.blogspot.com/-1ZHSGrcDBNM/U2Fpa741amI/AAAAAAAAAHU/9FYwwi9vzgI/s1600/snapshot.png)

Looks good! Now we just have to setup a trampoline in order to be able to call
`setcontext`, because we need a pointer to the code in `rax` remember? But
that's easy, we just add a new note, cross our fingers that it doesn't mess-up
everything. (If it does we can put it somewhere else, libc stdio buffers, a note
that we allocate before all this setting up, etc...)  Once we have our note with
the address of `context + 0x57` in it, we need to setup note0 with the address
of the trampoline. We can read the address in gdb, setting up note0 is business
as usual, it's the same as we did for `free` and `dump_file`.

Once we trigger this we have a shell. Full exploit can be found here:
[http://pastebin.com/0px8FEJ7](http://pastebin.com/0px8FEJ7) It works on my
machine, but it depends on libc which means it might require some adjustments
before it does on yours. gl;hf.

Ps: The reason I use bash and not sh for this exploit is that sh crashed on my
laptop when called from this exploit, I have no idea why.
