LESS-Watch-Compiler
===================

A nodejs script that allows you to watch a folder for changes and compile the less css files into another folder.

Always give credit where it's due. Parts of this script is modified from Mikeal Rogers's watch script (https://github.com/mikeal/watch)

###Prerequisites
Install LESS (http://www.lesscss.org/) and make sure the `lessc` binary is accessible to the script. Installing LESS with the `--global` flag will make the binary accessible to your system.
```npm install less --global```

###Usage 
```
node less-watch-compiler.js FOLDER_TO_WATCH FOLDER_TO_OUTPUT
```
###Example 
`"node less-watch-compiler.js less css"` will watch the `./less` folder and compile the LESS CSS files into `./css` when they are added/changed.
   
* Currently only compiles files with `.less` extension. This can be changed by modifying the `allowedExtensions` array.
* Scripts that starts with an underscore `_style.css` or period `.style.css` are ignored. This can be changed in the `filterFiles()` function.

* Github location: https://github.com/jonycheung/less-watch-compiler


