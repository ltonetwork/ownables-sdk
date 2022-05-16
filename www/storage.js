
// function forEachKey(callback) {
//     for (var i = 0; i < localStorage.length; i++) {
//       callback(localStorage.key(i));
//     }
//   }


function storeOwnableId(id) {
    var ownable_ids = JSON.parse(localStorage.getItem("ownable_ids"));
    ownable_ids.push(id)
    localStorage.setItem("ownable_ids", JSON.stringify(ownable_ids));

    // TODO handle ownable_id already present
} 

function getOwnableIds() {
    var ownable_ids = JSON.parse(localStorage.getItem("ownable_ids"));
    return ownable_ids
}