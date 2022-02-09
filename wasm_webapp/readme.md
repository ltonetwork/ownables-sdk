# Test webapp using basic WASM
This is a little webapp that loads a wasm function into javascript which interact with the html page.

It has a text input field where you can tyoe a number in the input box press the button and it will display the square of the input which is computed by the wasm code.

You can run it by hosting the html on localhost

### files:
math.wat            -> text represented wasm code
public/math.wasm    -> wasm code compiled from the math.wat
public/index.html   -> the html that reads the math.wasm
public/index.js     -> a js file to test how wasm works
