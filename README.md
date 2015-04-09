Dead Simple LESS CSS Watch Compiler
===================

A command that watches folders(and subfolders) for file changes and automatically compile the less css files into css. This is a file system watcher and compiler.

Parts of this script is modified from Mikeal Rogers's watch script (https://github.com/mikeal/watch)

## Prerequisites
Install LESS (http://www.lesscss.org/) and make sure the `lessc` binary is accessible to the script. Installing LESS with the `-g`(global) flag will make the binary accessible to your system.

```
(sudo) npm install -g less
```

## Installation
Install the `less-watch-compiler` command globally.

```
(sudo) npm install -g less-watch-compiler
```

## Usage 
```
less-watch-compiler FOLDER_TO_WATCH FOLDER_TO_OUTPUT
```
###Example #1
```
less-watch-compiler tests/less tests/css
```
The above command will watch the `tests/less` folder and compile the LESS CSS files into `tests/css` folder as soon as they are added/updated.

###Example #2
Add `less-watch-compiler.config.json` as follows in your project folder

```
{
    "allowedExtensions":["less"],
    "defaults": {
        "watchFolder": "tests/less",
        "outputFolder": "tests/css"
    }
}
```

The above will do the same as in example 1. But you can just run the following without passing the folders everytime.

```
less-watch-compiler
```

## Extras:
* By default, this script only compiles files with `.less` extension. More file extensions can be added by modifying the `allowedExtensions` array in `config.json`.
* Files that start with underscores `_style.css` or period `.style.css` are ignored. This behavior can be changed in the `filterFiles()` function.
* Github location: https://github.com/jonycheung/deadsimple-less-watch-compiler

### Using the source files
Alternativelly, you can checkout the code nad run things locally like this:

```
node less-watch-compiler.js [options]
```

To run unit tests: `npm test` (see tests/test.js)