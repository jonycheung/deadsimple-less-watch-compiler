Dead Simple LESS Watch Compiler
===================

A nodejs script that watches folders(and subfolders) for changes and automatically compile the less css files into css.

Always give credit where it is due. Parts of this script is modified from Mikeal Rogers's watch script (https://github.com/mikeal/watch)

## Prerequisites
Install LESS (http://www.lesscss.org/) and make sure the `lessc` binary is accessible to the script. Installing LESS with the `--global` flag will make the binary accessible to your system.

```
npm install -g less
```

## Installing via Bower
Instead of checking out this repo, you could install the package through bower(http://bower.io/).

```
bower install less-watch-compiler
```

## Usage 
```
node less-watch-compiler.js FOLDER_TO_WATCH FOLDER_TO_OUTPUT
```
####Example #1
```
node less-watch-compiler.js less css
```
The above command will watch the `less` folder and compile the LESS CSS files into `css` folder as soon as they are added/updated.

####Example #2
Setup `config.json` with default folders

```
{
    "allowedExtensions":["less"],
    "defaults": {
        "watchFolder": "less",
        "outputFolder": "css"
    }
}
```

The above will do the same as in example 1. But you can just run the following without passing the folders everytime.

```
node less-watch-compiler.js
```

## Extras:
* By default, this script only compiles files with `.less` extension. More file extensions can be added by modifying the `allowedExtensions` array in `config.json`.
* Files that start with underscores `_style.css` or period `.style.css` are ignored. This behavior can be changed in the `filterFiles()` function.
* Github location: https://github.com/jonycheung/Dead-Simple-LESS-Watch-Compiler


