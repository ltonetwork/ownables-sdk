
var target = document.querySelector("#ownable-list .list-group");
var template = '<a href="/ownable/~ownable_id~"><li class="list-group-item">~ownable_id~</li></a>';

ownable_ids = getOwnableIds();
ownable_ids.forEach(id => {
    target.insertAdjacentHTML("beforeend", template.replace(/~ownable_id~/g, id));
});
