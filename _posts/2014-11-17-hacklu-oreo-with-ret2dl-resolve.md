---
layout: post
title: "Hack.lu's OREO with ret2dl-resolve"
author: wapiflapi
tags:
- CTF
- 2k14
- writeup
- hacklu
- exploit
---

Hack.lu 2014 was really well done and entertaining. For one challenge we needed
to get `system` from an unknown libc while bypassing ASLR. The return to
dl-resolve technique I used wasn't known to me and I will explain it in this
post.

This exploit took me a ridiculous amount of time during the CTF and is overkill
in more than one place. Nevertheless the write-up should be interesting because
the technique known as return to dl-resolve wasn't known to me before and seems
to only be mentioned in Volume 0x0b, Issue 0x3a, Phile #0x04 and in a
[Japanese writeup](http://inaz2.hatenablog.com/entry/2014/07/27/205322) that I
didn't quite understand because I don't speak Japanese.

Here are some links to the challenge
[binary](https://github.com/ctfs/write-ups/tree/master/hack-lu-ctf-2014/oreo),
the original [exploit](http://hastebin.com/kogepozuhe.py) I used during the ctf
and [binexpect](https://github.com/wapiflapi/binexpect).

I won't cover the details of the fastbin exploit since that part is trivial;
reading the Malleficarum is the only thing required. I will cover the rest of my
exploit even the less interesting parts because some of them might be overkill
enough to be matter for amusement.

###Some stats about the problem:

  * **32 bit**. yes I know its 2014, tell hack.lu organizers ;-)
  * **CANARY, NX, ASLR, NO PIE**
  * **Unknown libc**, this off course I didn't notice until my exploit didn't
    work on the remote and I had to start over again doing things differently.
  * We have a pretty easy to use and repeatable leak primitive.


# Controlling the stack (twice)

Once the *House of Spirit* ensures us control over the next pointer to `malloc`,
one of the easiest ways to acquire execution control is to make it return an
address somewhere near the beginning of the GOT so you can overwrite it as per
usual.

From there you want to trigger your stack pivot so that you have a little more
stack space to play with.

There is a very nice gadget at 0x08048b42 which does `add esp, 0x1c ; pop3;
ret`. This does exactly what we want when called in place of `scanf` because it
will move the stack right into the buffer containing what we just typed at the
prompt (and we can trigger this as many times as we want.) Guess what? Yep,
didn't see that one during the CTF. I did something _way_ more complicated.

Here is what the GOT looked like after my overwrite:

| original GOT        | overwritten  |                                 |
|---------------------+--------------+---------------------------------|
| `link_map`          | target       | target stack                    |
| `dl-resolve`        | `0x08048ae3` | `pop ebp; ret;`                 |
| `printf`            | `printf`     |                                 |
| `free`              | `0x08048450` | `push link_map; jmp dl-resolve` |
| `fgets`             | `fgets`      |                                 |
| `__stack_chk_fail`  | `0x0804844c` | `leave; ret;`                   |
| `malloc`            | `malloc`     |                                 |
| `puts`              | `puts`       |                                 |
| `__gmon_start__`    | *garbage*    | clobbered w/ final nullbyte.    |
| `strlen`            | *untouched*  |                                 |
| `__libc_start_main` | *untouched*  |                                 |
| `__isoc99_sscanf`   | *untouched*  |                                 |

Notice the pointers to `link_map` and the `dl-resolve` function which aren't
usually considered part of the GOT but are located right in front of it.

The way this pivot works is as follows. On the next call to `free`, *target*
will be pushed on the stack and instead of dl-resolve our `pop ebp; ret` will be
excuted and return control to the original program. After some instructions the
canary is checked relative to ebp, of course it doesn't match anymore and we
regain control through our overwrite of `__stack_chk_fail`.  Because now we
control ebp we simply end with a classic `leave; ret;` which pivots our stack.

We now control where the stack points to. As we will see later my final ropchain
has some data with it so I needed somewhere to store it. The only large buffer
at a known address is the one where the message is normally stored. The trouble
with this is that it is too close to the GOT and when the stack grows it ends up
overwriting important entries such as `malloc` which isn't acceptable for our
exploit. So I decided to go with a small loader that I stored on the heap during
the initial preparations for the House of Spirit, I know the address of this
because it is very easy to leak.


| ropchain     |                                                |
|--------------+------------------------------------------------|
| `finaltack`  | ebp == some location in the middle of the heap |
| `fgets`      | `fgets(finalstack, 1025, stdin)`               |
| `0x0804844c` | `leave; ret;`                                  |
| `finalstack` | this is also where we write to                 |
| `1025`       |                                                |
| `stdin`      |                                                |

After this we control the stack for real. We can simply send our ropchain and
take up as much space as we want.

# Getting a shell

A lot of the work until now was getting a nice stack to play with. In the first
version of this exploit I didn't do any of this because I thought I could just
guess which libc was running based on the addresses I leaked from the GOT and
simply return to system at some point. But, in the challenge's author's own
words:

> cutz: yea the libc is self compiled [and] guessing offset sucks ^^

So. Let's get thinking, unknown libc and ASLR. Sounds familiar? Wasn't to me.
As it turns out there are a couple of quite simple solutions (see at the end of
this writeup). But you know, its way more fun to go with the trick that no one
is using since 2001 especially during a 48h CTF that is scheduled in the middle
of the goddamn week when I'm supposed to be working.

## Return to dl-resolve

After some other wild ideas that obviously didn't work or I would be writing
about them instead, it dawned upon me that this had to be a solved problem. If
system (which is what I really wanted to call) had been used in the binary how
would its address end up in the GOT the first time it's called anyway? Looking
this up is a matter of googling; the initial call to a library function ends up
calling `dl-resolve` and passing it an index into the binary's (not library's!)
relocation table and a pointer to something called `link_map`.  While googling I
also noticed the Japanese
[writeup](http://inaz2.hatenablog.com/entry/2014/07/27/205322) that mentioned
this technique so I was pretty sure this would work.

I guess if it simply passed the symbol's name it would be too easy, right?
Instead it uses the relocation entry to get an index into a symbol table which
in turn yields an index in the string table which gives it the function's
name. This name is then used to resolve the symbol in the library. How does it
get the library?  Well link_map is a linked list of all loaded libraries, it
finds it in there.

This technique is all about calling `dl-resolve` with specially crafted
arguments. We give it the index into the relocation table for system and the
original value for `link_map`. This is all very cool, except for the fact system
isn't in that table. If it was it would also be in the GOT/PLT and we wouldn't
be having this whole problem in the first place. The thing is, however, that
this index doesn't really have to fit in the table. It can be way bigger so that
the relocation entry it points to is somewhere we control.

### Structure layout

```C
Elf32_Rel *reloc = JMPREL + index;
Elf32_Sym *sym = &SYMTAB[ELF32_R_SYM(reloc->r_info];
name = STRTAB + sym->st_name;
```

`index` is the argument to `dl-resolve` and `JMPREL`, `SYMTAB` and `STRTAB` are
constants because they are addresses of parts of the binary and there is no PIE.

We have everything we need to setup some fake structures on the heap, compute
the correct index and pass it to dl-resolve.

This works pretty well for the first line, but `reloc->r_info` is only stored
using one byte and the heap is far away from the original symtab (which is in
the binary!). This is a problem because there is no writable memory at all
within 4096 (`256 * sizeof (Elf32_Sym)`) bytes of the symtab.

The solution to this is a small detour. It turns out the symtab location isn't
computed from scratch each time by parsing the binary, instead it is available
at a known location in the .bss. Lets quickly overwrite that using a call to
`fgets` and make everyone believe the symtab is on the heap!

Once this is done we can execute our plan using the fake structures we have
setup and `dl-resolve` will fetch `system` and return to it for us.

## Alternative: Do it yourself

After doing the previous technique during the CTF I learned it isn't that hard
to locate libc. You can simply round a known address down to a multiple of
pagesize and keep subtracting pagesizes until it starts with `\x7fELF`. Another
(cleaner) way is, you know, to simply loop through the `link_map` until you find
the library you're looking for. That's what the bloody thing is supposed to be
used for after all. (If you don't know what `link_map` is you should have read
the previous section.)

Once you have the start of libc and you have something that lets you repeatedly
leak from an arbitrary address it is trivial to parse any library's `.dynsym` to
retrieve whatever symbol. This technique can be seen in this
[exploit](https://github.com/ctfs/write-ups/blob/master/hack-lu-ctf-2014/oreo/exploit-by-cutz.pl).

Because those conditions are met most of the time, I think this is the reason
the previous technique is so rarely used since it requires a lot of fake
structure setup. I believe the return to `dl-resolve` can still be useful
sometimes because it doesn't require any leaks per-se. In a non PIE binary it
should be possible to pull it off without leaking anything. The only time I had
to leak stuff in this exploit was because I had to corrupt the whole GOT to do
my overly-complicated pivot and still needed the original values for later.

