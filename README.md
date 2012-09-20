less-watch-compiler
===================

A nodejs script that allows you to watch a folder for changes and compile the less css files into another folder.

Always give credit where it's due. Parts of this script is modified from Mikeal Rogers's watch script (https://github.com/mikeal/watch)

##Usage 
```
node less-watch-compiler.js FOLDER_TO_WATCH FOLDER_TO_OUTPUT
```
##Example 
`"node less-watch-compiler.js less css"` will watch the `./less` folder and compile the less css files into `./css` when they are added/changed
   
* Currently only compiles files with .less extension
* Scripts that starts with an underscore (_style.css) or period (.style.css) are ignored. This can be changed in the `filterFiles()` function.
* Github location: https://github.com/jonycheung/less-watch-compiler