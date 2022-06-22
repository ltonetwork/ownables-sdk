
// function forEachKey(callback) {
//     for (var i = 0; i < localStorage.length; i++) {
//       callback(localStorage.key(i));
//     }
//   }


export function storeOwnableId(id) {
    let ownableIds = JSON.parse(localStorage.getItem("ownable_ids"));
    console.log("existing ownable ids:", ownableIds);
    if (typeof ownableIds !== typeof Set) {
        // if corrupt or uninitialized
        ownableIds = new Set();
    }
    ownableIds.add(id);
    localStorage.setItem("ownable_ids", JSON.stringify(ownableIds));
}

export function getOwnableIds() {
    return JSON.parse(localStorage.getItem("ownable_ids"))
}
