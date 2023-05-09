
# static Ownables template

This is a static ownables template made to add unlockable content for an NFT.

An owner of the NFT can get the unlockable content from the bridge.
Advantage of this approach is that the NFT doesn't need to be locked,
since the content isn't mutable.

Following files need to be updated:

## package.json

Add your erc-721 information to `package.json`.

## media files

Replace the existing media file with file of your choice.

## index.html

Update the html template body so that the media tag source
is the same as the name of your media file.
E.g., if you wish to add `car.mp4` video, the media tag may look like this:

```html
<video autoplay muted loop>
    <source type="video/mp4" src="car.mp4">
    Sorry, your browser doesn't support embedded videos.
</video>
```

