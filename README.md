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



Dead Simple JQuery Key Combo
============================

Copyright 2012, Jonathan Cheung
Licensed and released under the MIT license. Refer to MIT-LICENSE.txt.

Requires: jQuery

## USAGE 1
Use the default KONAMI CODE "UP UP DOWN DOWN LEFT RIGHT LEFT RIGHT B A"
```
var comboController1 = new DeadSimpleJQueryKeyCombo(jQuery);
comboController1.addTrigger(function() {
    alert("BINGO! Now we do something interesting!");
});
```


## USAGE 2 
And you can add your own combo this way. (You need to assign the ‘Key’ object has the keyboard key mappings you want.)
```
//Create a new controller to use a different combo
var comboController2 = new DeadSimpleJQueryKeyCombo(jQuery);
comboController2.clearCombo();
//Add combo 1
comboController2.addCombo(  comboController2.Key.A,comboController2.Key.A, 
                            comboController2.Key.B);
//Add combo 2
comboController2.addCombo(  comboController2.Key.UP,comboController2.Key.UP, 
                            comboController2.Key.UP, comboController2.Key.UP);
comboController2.addTrigger(function() {
     alert("BINGO! Now we do something ELSE interesting!");
});
```