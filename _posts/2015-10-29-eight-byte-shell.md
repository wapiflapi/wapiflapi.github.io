---
layout: post
title: "Eight bytes to get a shell."
author: wapiflapi
tags:
- CTF
- 2k15
- writeup
- hacklu
- exploit
---

This will be a quick one. Last week was hacklu again. And again it was in the
middle of the week. Nothing they can do about that they say, and I believe them
of course! Point being I didn't have time to play properly, I only looked at one
challenge. There was one little trick I liked and wanted to share.

__*Petition Builder*__ is a chalenge presenting itself as a website built using
PHP. It's very simple: a form to submit petitions. A parameter allows to prefil
the text you want to submit, and a quick check shows it gives read access any
file on the system.

Dumping source code and configuration files gives us a better understanding of
the challenge. There is a PHP module that is loaded as a shared object. It has a
function `array_get_hashes` that is called from the PHP script.

It took me a (long) while, but I finally figured out where the vulnerability
lay. I'll admit I didn't see it reading the C code at first, which I'm truly
ashamed for. I had to resort to doing tests to notice I was getting garbage
back. From there I fired gdb to see what was up. Turned out some variable in a
loop was always used but only set in one of two cases. Because of how PHP works,
and the fact that this was used to initialize an array, the object was freed
each time. Meaning that the one time it was used without being set it would
cause a _use after free_. Long story short it was really easy to control the
contents of a `ZVal` and gaining control of the execution by hijacking a method
call.

```
call [rax] ; controled rax and rdi pointing to 8 controled bytes.
```

Afterwards, the organizers told me they expected us to ROP our way out of
there. But I wasn't in the mood of checking all of the available gadgets. With a
fairly easy leak and all of PHP and it's libraries this would have been very
doable but it looked so time consuming! I was lazy.

System was in the GOT so calling it with `call [rax]` is easy enough. `rdi` also
pointed to controled bytes. I didn't _want to_ search for anything else.

Getting a shell in 8 bytes is easy: `'sh <&3;'`, or whatever fd is used for the
connection. But no, that did not work for apache/php. The developers are smart
enough to set the appropriate `FD_CLOEXEC` flags. Well done!

Something more clever was needed. I didn't think it was possible to craft a file
by appending stuff byte per byte. `'echo a>x;'` is one byte too long, and without
the `;` (or null byte) the filename would be garbage. I was prety sure the cwd
wouldn't even be writable.

The next best thing to get our data on the server was relying on PHP. If you
send files using `POST` it stores them on disk waiting for them to be needed. A
check of `php.ini` confirmed that that they would be stored in the system's tmp
directory: `/tmp/php2dz5FZ` something like this.

__Now, `'. /*/*J;'` is eight bytes.__ It took about 20 tries for php to randomly pick
`'J'` as the last letter while I crossed my fingers that nothing else on the remote
system would match `*J`; it didn't on mine.

It took a bit longer for me to realise that they had strict firewalls in place
preventing my PoC from calling home. Just needed to write all output to a known
file and use the website vulnerability to read it.
