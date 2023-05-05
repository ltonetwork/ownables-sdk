# media ownables template

This is a simple media ownables template made to build upon.
To customize it to your liking, alter the following files.

# Files to update

## `contract.rs`

In contract.rs, replace the strings in the `instantiate` method on lines 30, 37, and 38.

## `Cargo.toml`

On Cargo.toml, replace the package name and description on lines 2 and 3.

## `assets/image.png`

Replace the image with one you want. You are free to name it as you wish.
The filetype can be anything that is supported by HTML, such as:
- gif
- jpeg
- png
- svg

## `assets/index.html`

In the template file, alter the `<body>` to your needs. For this basic example,
just update the `<img src="image.png">` src field to reflect the name of the
image you uploaded.

# Building your Ownables

After you update the files described above, follow the same build process as
described in the `README.md` file at the root directory of this repository.
