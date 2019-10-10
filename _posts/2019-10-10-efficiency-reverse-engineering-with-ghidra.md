---
layout: post
title: "Efficiency: Reverse Engineering with ghidra"
author: wapiflapi
tags:
- CTF
- 2k19
- writeup
- rtfm
- re
- reverse engineering
---

It's been a while since I haven't written anything on here, but I
thought I'd do a quick write-up for one of the challenges from
[RTFM](https://qual.rtfm.re/rules).

We're given a single binary and told to find a flag. The executable

```
~/Projects/ctf/rtfm$ file efficiency_fixed
efficiency_fixed: ELF 64-bit LSB shared object, x86-64, ...
~/Projects/ctf/rtfm$ ./efficiency_fixed
Please enter the password:
foobar
```

We don't get any more output after we entered the "password"
(`foobar` in the example above.)


## Enter [Ghidra](https://github.com/NationalSecurityAgency/ghidra)

I'm going to be using Ghidra for the reverse engineering but other
tools work in similar ways and this write-up could probably be
followed with any of them.

After creating a project in ghidra for the CTF (or just using your
everything-goes-here project) and after using `File > Import File` to
add our binary to the project we can open it tell Ghidra that `Yes` we
would like to analyze the file right now when prompted.

In the `Symbol Tree` we notice there are only a dozen functions we
don't recognize so let's start looking at what they do.

```c
void FUN_00101020(void) {
  // WARNING: Treating indirect jump as call
  (*(code *)(undefined *)0x0)();
  return;
}
```

Okay. Looking at the listing (assembly) for this we see it's an
indirect jump to something taken at a global address. This function
also doesn't seem to be referenced by any of the others. Let's skip
this for now, probably not important.


### Lots of small functions

`FUN_001010a0` and `FUN_001010d0` are no more interesting than the
previous one, but then we have a whole lot of very small functions
that seem to actually do stuff.

**Most of them take two arguments and do a very simple operations.**
This looks a lot like the naive implementation of byte-code
interpreters we are used to seeing in CTFs. Let's rename all those
functions to what we assume they'll be doing:


```c
void FUN_00101155(undefined4 *puParm1, undefined4 *puParm2) {
  *puParm1 = *puParm2;
  return;
}
```

`FUN_00101155` seems to be some sort of `mov` instruction. Let's
rename it to `do_mov_aX_bX`. I like being explicit about the number of
arguments they take (following "destination before source" convention)
and about whether they deference them or not. The `X` indicates those
arguments are dereferenced which would be obvious for the destination
(a) but not so much for the source (b). At this point you could also
take the time to update the function prototypes in Ghidra, letting it
know that they take `(int *, int *)` (for most of them.)

If we do the same for all the little functions we end up with:

```c
void do_mov_aX_bX(undefined4 *puParm1, undefined4 *puParm2) {
  *puParm1 = *puParm2;
}

void do_mov_aX_b(undefined4 *puParm1, undefined4 uParm2) {
  *puParm1 = uParm2;
}

void do_xor_aX_bX(uint *puParm1, uint *puParm2) {
  *puParm1 = *puParm1 ^ *puParm2;
}

void do_add_aX_bX(int *piParm1, int *piParm2) {
  *piParm1 = *piParm1 + *piParm2;
}

void do_sub_aX_bX(int *piParm1, int *piParm2) {
  *piParm1 = *piParm1 - *piParm2;
}

void do_rol_aX_bX(int *piParm1, undefined8 uParm2) {
  *piParm1 = *piParm1 << ((byte)uParm2 & 0x1f);
}

void do_ror_aX_bX(int *piParm1, undefined8 uParm2) {
  *piParm1 = *piParm1 >> ((byte)uParm2 & 0x1f);
}
```

### Dealing with global variables

The functions above all follow the exact same pattern so it's easy to
name them. We also encounter some of those small functions that read
and write to some global `DAT_something` variables. Let's just
continue with our naming scheme until we find anything better to do:


```c
void do_mov_DAT_0010506c_aX(undefined4 *puParm1) {
  DAT_0010506c = *puParm1;
}

void do_mov_DAT_00105068_cmp_aX_bX(int *piParm1, int *piParm2) {
  DAT_00105068 = *piParm1 != *piParm2;
}
```

With that last one we're starting to see that those global variables
might be used to store things like flags and important information
about the state of the virtual machine that might (we're guessing!)
be running inside this binary.

Our suspicions are confirmed by the following three functions which
look an awful lot like (unconditional) `jmp`, `jnz` (jmp if non zero)
and `jz` (jmp if zero).

```c

void do_jmp_a(undefined4 uParm1) {
  DAT_00105064 = uParm1;
}

void do_jnz_a(undefined4 uParm1) {
  if (DAT_00105068 != 0) {
    DAT_00105064 = uParm1;
  }
}

void do_jz_a(undefined4 uParm1) {
  if (DAT_00105068 == 0) {
    DAT_00105064 = uParm1;
  }
}

```

**We are now presuming the following:**
  - `DAT_00105068` is actually a global `SHOULDJMP` flag.
  - `DAT_00105064` is what is modified by the jump, it's reasonable
     to assume it is the current instruction pointer `DATA_IP`.

We still haven't seen anything resembling the main function, or
whatever it is that is prompting us for a password when running the
binary. We could go searching for that but let's just finish all
functions in order, we're almost done anyway.


### FUN_001012c6 - Re-discovering mathematics.

The next function is somewhat more complicated than the small
operations we've been seeing so far.

```c
void FUN_001012c6(int *piParm1,int *piParm2) {
  long local_20;
  ulong local_18;
  long local_10;

  local_10 = 1;
  local_18 = SEXT48(DAT_00104074);
  local_20 = (long)*piParm1;
  while (local_18 != 0) {
    if ((local_18 & 1) != 0) {
      local_10 = SUB168((ZEXT816(0) << 0x40 | ZEXT816((ulong)(local_10 * local_20))) %
                        ZEXT816((ulong)(long)*piParm2),0);
    }
    local_18 >>= 1;
    local_20 = SUB168((ZEXT816(0) << 0x40 | ZEXT816((ulong)(local_20 * local_20))) %
                      ZEXT816((ulong)(long)*piParm2),0);
  }
  *piParm1 = (int)local_10;
}
```

`SEXT48`, `SUB168` and `ZEXT816` are not standard C and might look
weird, **ghidra's built-in help is really good and deserves to be used a
lot.**

In the Decompiler section we find that:

> **SUB41(x,c) - truncation operation**
> The 4 is the size of the input operand (x) in bytes.
> The 1 is the size of the output value in bytes.
> The x is the thing being truncated
> The c is the number of least significant bytes being truncated
>
> **EXT14(x) - zero extension**
> The 1 is the size of the operand x
> The 4 is the size of the output in bytes
> This is almost always a cast from small integer types to big unsigned types.
>
> **SEXT14(x) - signed extension**
> The 1 is the size of the operand x
> The 4 is the size of the output in bytes
> This is probably a cast from a small signed integer into a big signed integer.

All this is simply an indication that the compiler had to juggle
between 4 byte, 8 byte and 16 byte operands for the code we're looking
at. In most cases we probably don't care about that for understanding
the code so let's simplify for readability:


```c
void FUN_001012c6(int *piParm1,int *piParm2) {
  long local_20;
  ulong bit_vector;
  long result;

  result = 1;
  bit_vector = DAT_00104074;
  local_20 = *piParm1;
  while (bit_vector != 0) {
    if ((bit_vector & 1) != 0) {
      result = (result * local_20) % *piParm2;
    }
    bit_vector >>= 1;
    local_20 = (local_20 * local_20) % *piParm2;
  }
  *piParm1 = result;
}
```

Notice that we're looping over all the bits in`bit_vector` (originally
`local_18`) and computing `local_10` (renamed to `result`) which gets
assigned to `*piParm1` as usual with all the operations we've seen so
far. `*piParm2` seems to be some sort of modulus as it's only used for
that.

According to ghidra `DAT_00104074` is `0x10001` and there are no other
direct references to it (apart from the function we're looking at) that
could modify it so for now let's assume that's a constant.

Rewriting this function in python and unrolling the loop:

```python
def do_something(a, b):
    result = 1

    # first bit is always 1
    result = (result * a) % b
    a = (a * a) % b

    # then we always have 15 bits that are 0
    # a = (a * a) % b  # 15 times, which is a ** 2 ** 15
    a = (a ** 2 ** 15) % b

    # last bit is always a 1 again
    result = (result * a) % b
    a = (a * a) % b  # Notice this line does not affect the result.

    return result
```

Simplifying the above _again_ we get:

```python
def do_something(a, b):
    result = a % b
    # Now a changes:
    a = a ** 2 ** 16  # because: ((a ** 2) ** 2 ** 15) % b
    # And is used again in the result:
    return (result * a) % b
```

Finally we end up with `return (a * a ** 2 ** 16) % b`
  - which is `return (a ** (2 ** 16 + 1)) % b`
  - which is `return (a ** 0x10001) % b`

So **this function is basically just a `do_aX_pow_0x10001_mod_bX`
operation**, If you couldn't tell because of my way of solving maths
above: I'm not really good at maths.

And with that it looks like we're done with all the small-ish
functions that take one or two parameters and store their result in
the first one.


### On to main.

```c

undefined8 FUN_001017e4(void) {
  // ...
  puts("Please enter the password: ");
  read(0,&local_28,0x14);
  FUN_0010138b(&local_28);
}
```
Seems like we need to look at `FUN_0010138b` next: it takes our password as input.

It's a big function! It has two `while` loops followed by a `do { }
while` with lots of `if`/`else` inside.  Looks like we found whatever
it is that's going to call all of the functions read before.

Let's focus on the big mess first:

```c
 do {
  a = local_data[(long)(DATA_IP + 1)];
  b = local_data[(long)(DATA_IP + 2)];
  op = local_data[(long)DATA_IP];
  if (op == 0x789abcde) {
   do_cmp_ax_bx(&DAT_00104060 + (long)a,&DAT_00104060 + (long)(int)b,
          &DAT_00104060 + (long)(int)b);
  }
  else {
   if (op < 0x789abcdf) {
    if (op == 0x6789abcd) {
     do_jmp_a();
    }
    else {
     if (op < 0x6789abce) {
      if (op == 0x56789abc) {
       do_jz_a();
      }
      else {
       if (op < 0x56789abd) {
        if (op == 0x456789ab) {
         do_add_aX_bX(&DAT_00104060 + (long)a,&DAT_00104060 + (long)(int)b,
                &DAT_00104060 + (long)(int)b);
        }
        else {
         if (op < 0x456789ac) {
          if (op == 0x3456789a) {
           do_xor_aX_bX(&DAT_00104060 + (long)a,&DAT_00104060 + (long)(int)b,
                  &DAT_00104060 + (long)(int)b);
          }
          else {
           if (op < 0x3456789b) {
            if (op == 0x23456789) {
             do_mov_aX_b(&DAT_00104060 + (long)a,(ulong)b);
            }
            else {
             if (op < 0x2345678a) {
              if (op == 0x12345678) {
               do_mov_aX_bX();
              }
              else {
               if (op < 0x12345679) {
                if (op == -0x10fedcbb) {
                 do_sub_aX_bX();
                }
                else {
                 if (op < -0x10fedcba) {
                  if (op == -0x210fedcc) {
                   do_jnz_a();
                  }
                  else {
                   if (op < -0x210fedcb) {
                    if (op == -0x3210fedd) {
                     do_aX_pow_0x10001_mod_bX();
                    }
                    else {
                     if (op < -0x3210fedc) {
                      if (op == -0x43210fee) {
                       do_mov_DAT_0010506c_aX();
                      }
                      else {
                       if (op < -0x43210fed) {
                        if (op == -0x543210ff) {
          // WARNING: Subroutine does not return
                         exit(DAT_0010506c);
                        }
                        if (op < -0x543210fe) {
                         if (op == -0x76543211) {
                          do_rol_aX_b();
                         }
                         else {
                          if (op == -0x65432110) {
                           do_ror_aX_b();
                          }
                         }
                        }
                       }
                      }
                     }
                    }
                   }
                  }
                 }
                }
               }
              }
             }
            }
           }
          }
         }
        }
       }
      }
     }
    }
   }
  }
  DATA_IP += 3;
 } while( true );
```

**All the `<` comparisons are compilation artifacts**, the original
code probably had a `switch`/`case` and the compiler decided to
implement some sort of binary balanced tree to reduce the number of
comparisons needed for each `case`. We can safely remove them since
the `==` comparisons are sufficient.

We also notice that some of the functions we know about (eg:
`do_mov_aX_bX`) don't seem to take the right numbers of
arguments. It's hard for the decompiler to guess those in all
circumstances but we can help! `right click > Edit Function Signature`
and we can set the prototype we wish for all those functions.

**With those two things everything looks much cleaner:**


```c
do {
    param_a = local_data[(DATA_IP + 1)];
    param_b = local_data[(DATA_IP + 2)];
    op = local_data[DATA_IP];
    if (op == 0x789abcde) {
        do_cmp_ax_bx();
    }
    if (op == 0x6789abcd) {
        do_jmp_a((param_a + -1) * 3);
    }
    if (op == 0x56789abc) {
        do_jz_a((param_a + -1) * 3);
    }
    if (op == 0x456789ab) {
        do_add_ax_bx
            (&DAT_00104060 + param_a,
             &DAT_00104060 + param_b);
    }
    if (op == 0x3456789a) {
        do_xor_ax_bx
            (&DAT_00104060 + param_a,
             &DAT_00104060 + param_b);
    }
    if (op == 0x23456789) {
        do_mov_ax_b
            (&DAT_00104060 + param_a,
             param_b);
    }

    if (op == 0x12345678) {
        do_mov_ax_bx
            (&DAT_00104060 + param_a,
             &DAT_00104060 + param_b);
    }
    if (op == -0x10fedcbb) {
        do_sub_ax_bx
            (&DAT_00104060 + param_a,
             &DAT_00104060 + param_b);
    }
    if (op == -0x210fedcc) {
        do_jnz_a((param_a + -1) * 3);
    }
    if (op == -0x3210fedd) {
        do_aX_pow_0x10001_mod_bX
            (&DAT_00104060 + param_a,
             &DAT_00104060 + param_b);
    }
    if (op == -0x43210fee) {
        do_mov_DATA_ax(&DAT_00104060 + param_a);
    }
    if (op == -0x543210ff) {
        // WARNING: Subroutine does not return
        exit(DAT_0010506c);
    }
    if (op == -0x76543211) {
        do_rol_ax_b(&DAT_00104060 + param_a,
                    param_b);
    }
    if (op == -0x65432110) {
        do_ror_ax_b(&DAT_00104060 + param_a,
                    param_b);
    }
    DATA_IP += 3;
 }  while (true);
```


Much more readable already !

**A couple things we learned from this:**
  - `DAT_0010506c` is the value with which the program will exit,
    which means that `do_mov_DAT_0010506c_aX` can be renamed to
    `do_mov_DAT_EXIT_aX` or `do_ldexit_aX`.
  - We now have a mapping between "instruction numbers" and functionality.
  - It looks like instructions are encoded on `3 * 4bytes` in `local_data`.


## Getting the code

At this point we could either attach gdb and set a breakpoint when we know
`local_data` has been initialized and dump the instructions like that.

Or read the RTFM (rest of fucking main) and learn that it's being
loaded from global memory, relevant code;

```c
  puVar4 = &DAT_00102020;
  puVar5 = local_data;
  while (lVar3 != 0) {
    lVar3 += -1;
    *puVar5 = *puVar4;
    puVar4 = puVar4 + 1;
    puVar5 = puVar5 + 1;
  }
```

Either way we find the code and we can start writing a quick
dis-assembler for the operations we now about:


```python
#!/usr/bin/env python3

import struct


DATA_CODE = bytes.fromhex(
    "896745230400000003000000cdab8967040000000000000012f0debcff030000"
    "0000000001efcdab000000000000000089674523050000000100010089674523"
    "00010000fa20140389674523000200002d74c77789674523010100006bda742b"
    "89674523010200002de3617d8967452302010000bf8286638967452302020000"
    "19bc4d7b896745230301000021d7415989674523030200005f6ec26289674523"
    "04010000bb41ed5c8967452304020000f79364682301efcd1000000000020000"
    "debc9a7810000000000100003412f0de02000000000000002301efcd11000000"
    "01020000debc9a7811000000010100003412f0de02000000000000002301efcd"
    "1200000002020000debc9a7812000000020100003412f0de0200000000000000"
    "2301efcd1300000003020000debc9a7813000000030100003412f0de02000000"
    "000000002301efcd1400000004020000debc9a7814000000040100003412f0de"
    "020000000000000089674523ff03000001000000cdab89670200000000000000"
)


def arg(x):
    """Represent a direct argument."""
    return "%#x" % x


def argX(x):
    """Represent a de-referenced argument."""
    return "[%#x]" % x


def noarg(x):
    """Represent the absence of argument."""
    return ""


OP_MAP = {
    0x789abcde:  ("cmp",    argX,  argX),
    0x6789abcd:  ("jmp",    arg,   noarg),
    0x56789abc:  ("jz",     arg,   noarg),
    0x456789ab:  ("add",    argX,  argX),
    0x3456789a:  ("xor",    argX,  argX),
    0x23456789:  ("mov",    argX,  arg),
    0x12345678:  ("mov",    argX,  argX),
    -0x10fedcbb: ("sub",    argX,  argX),
    -0x210fedcc: ("jnz",    arg,   noarg),
    -0x3210fedd: ("powmod", argX,  argX),
    -0x43210fee: ("ldexit", argX,  noarg),
    -0x543210ff: ("exit",   noarg, noarg),
    -0x76543211: ("rol",    argX,  arg),
    -0x65432110: ("ror",    argX,  arg),
}


if __name__ == "__main__":

    # Loop over DATA_CODE in chunks of 3*4 bytes because we will load
    # the op and the two args which are four bytes each.
    for i, ci in enumerate(range(0, len(DATA_CODE), 3*4)):
        op, a, b = struct.unpack("iii", DATA_CODE[ci:ci+3*4])
        op, rep_a, rep_b = OP_MAP[op]
        print("%2d:  %8s  %8s %s" %  (i, op, rep_a(a), rep_b(b)))
```

This program when run gives us a nice idea of what we are looking at.

## Understanding the code

```
~/Projects/ctf/rtfm$ ./writeup.py
 0:       mov     [0x4] 0x3
 1:       jmp       0x4
 2:    ldexit   [0x3ff]
 3:      exit
 4:       mov     [0x5] 0x10001
 5:       mov   [0x100] 0x31420fa
 6:       mov   [0x200] 0x77c7742d
 7:       mov   [0x101] 0x2b74da6b
 8:       mov   [0x201] 0x7d61e32d
 9:       mov   [0x102] 0x638682bf
10:       mov   [0x202] 0x7b4dbc19
11:       mov   [0x103] 0x5941d721
12:       mov   [0x203] 0x62c26e5f
13:       mov   [0x104] 0x5ced41bb
14:       mov   [0x204] 0x686493f7
15:    powmod    [0x10] [0x200]
16:       cmp    [0x10] [0x100]
17:       jnz       0x2
18:    powmod    [0x11] [0x201]
19:       cmp    [0x11] [0x101]
20:       jnz       0x2
21:    powmod    [0x12] [0x202]
22:       cmp    [0x12] [0x102]
23:       jnz       0x2
24:    powmod    [0x13] [0x203]
25:       cmp    [0x13] [0x103]
26:       jnz       0x2
27:    powmod    [0x14] [0x204]
28:       cmp    [0x14] [0x104]
29:       jnz       0x2
30:       mov   [0x3ff] 0x1
31:       jmp       0x2
```

Reading this it looks like we always end up jumping to `0x2` which
`ldexit [0x3ff]` and then `exit` with that value.

Since we still don't know where we're going to get the flag the best
we can do is try to exit with a non-zero value. (Since when we input
garbage as a password the program exits with status code 0.)

The only way to do that is on line `30:` when `0x1` is loaded into
`[0x3ff]` so the goal becomes to get there.

To do so we need to successfully avoid all the `jnz` before that.

**Re-ordering the code for clarity we get:**

```
 5:       mov   [0x100] 0x31420fa
 6:       mov   [0x200] 0x77c7742d
15:    powmod    [0x10] [0x200]
16:       cmp    [0x10] [0x100]
17:       jnz       0x2

 7:       mov   [0x101] 0x2b74da6b
 8:       mov   [0x201] 0x7d61e32d
18:    powmod    [0x11] [0x201]
19:       cmp    [0x11] [0x101]
20:       jnz       0x2

 9:       mov   [0x102] 0x638682bf
10:       mov   [0x202] 0x7b4dbc19
21:    powmod    [0x12] [0x202]
22:       cmp    [0x12] [0x102]
23:       jnz       0x2

11:       mov   [0x103] 0x5941d721
12:       mov   [0x203] 0x62c26e5f
24:    powmod    [0x13] [0x203]
25:       cmp    [0x13] [0x103]
26:       jnz       0x2

13:       mov   [0x104] 0x5ced41bb
14:       mov   [0x204] 0x686493f7
27:    powmod    [0x14] [0x204]
28:       cmp    [0x14] [0x104]
29:       jnz       0x2
```

We know that `powmod` is `a ** 0x10001 % b` so this gives us:

```
0x031420fa == [0x10] ** 0x10001 % 0x77c7742d
0x2b74da6b == [0x11] ** 0x10001 % 0x7d61e32d
0x638682bf == [0x12] ** 0x10001 % 0x7b4dbc19
0x5941d721 == [0x13] ** 0x10001 % 0x62c26e5f
0x5ced41bb == [0x14] ** 0x10001 % 0x686493f7
```

At this point I'm starting to assume that `0x10-0x14` will contain our
input in some form. So let's solve these equations and see what gives.

_Wait._ I'm **bad** at math.

https://www.wolframalpha.com/

But it doesn't understand python. Rewrite everything to human-ish-speak.

```
x ^ 65537 = 51650810 mod 2009560109
x ^ 65537 = 729078379 mod 2103567149
x ^ 65537 = 1669759679 mod 2068691993
x ^ 65537 = 1497487137 mod 1656909407
x ^ 65537 = 1559052731 mod 1751421943
```

Copy pasting the above (line by line) in
[wolfram](https://www.wolframalpha.com/) we get back:

```
x congruent 1936287603 (mod 2009560109)
x congruent 1701279355 (mod 2103567149)
x congruent 1447900004 (mod 2068691993)
x congruent 1601401973 (mod 1656909407)
x congruent 1717969277 (mod 1751421943)
```

Let's see what that means if that was part of a password:

```python
>>> results = [1936287603, 1701279355, 1447900004, 1601401973, 1717969277]
>>> print(struct.pack("iiiii", *results))
b'sgis{vged3MVuts_}!ff'
```

That almost looks like a flag, but it might be big endian instead of
(default) little endian. Let's try again:

```python
>>> print(struct.pack(">iiiii", *results))
b'sigsegv{VM3d_stuff!}'
```

**There we go.**


All in all this was an excellent typical reverse engineering challenge
to practice understanding ctf-style bytecode interpreters.
