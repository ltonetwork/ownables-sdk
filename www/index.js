import {consumeOwnable, deleteOwnable, issueOwnable, syncDb, transferOwnable} from "./wasm-wrappers";
import {fetchImg, importAssets} from "./asset_import";
// if no chainIds found, init empty
if (localStorage.getItem("chainIds") === null) {
  localStorage.chainIds = JSON.stringify([]);
}

export function getDrinkAmount(ownable_id) {
  let stringAmount = document.getElementById(ownable_id)
    .getElementsByClassName('slider')[0].valueOf().value;
  return parseInt(stringAmount);
}

export function updateState(ownable_id, amt) {
  document.getElementById(ownable_id).getElementsByClassName('juice')[0].style.top = (100 - amt) / 2 + '%';
  document.getElementById(ownable_id).getElementsByClassName('amount')[0].textContent = amt;
}

export function initializePotionHTML(ownable_id, amount, color) {
  injectPotionToGrid(ownable_id, color);
  updateState(ownable_id, amount);
  const ownableHTML = document.getElementById(ownable_id);
  ownableHTML.getElementsByClassName("drink-button")[0]
    .addEventListener('click', () => consumeOwnable(ownable_id));
  ownableHTML.getElementsByClassName("transfer-button")[0]
    .addEventListener('click', () => transferOwnable(ownable_id));
  ownableHTML.getElementsByClassName("delete-button")[0]
    .addEventListener('click', () => {
      if (confirm("Are you sure you want to delete this Ownable?")) {
        deleteOwnable(ownable_id);
        ownableHTML.parentElement.remove();
      }
    });
}

function injectPotionToGrid(ownable_id, color) {
  const potionGrid = document.getElementsByClassName("grid-container")[0];
  const potionElement = document.createElement('div');
  potionElement.classList.add('grid-item');
  potionElement.innerHTML = getPotionTemplate(ownable_id).trim();
  findImgSources(potionElement.firstChild);
  potionGrid.appendChild(potionElement);
  document.getElementById(ownable_id).getElementsByClassName('juice')[0].style.backgroundColor = color;
}

function findImgSources(htmlTemplate) {
  let allElements = htmlTemplate.getElementsByTagName("*");
  const request = window.indexedDB.open("assets");
  request.onblocked = (event) => console.log("idb blocked: ", event);
  request.onerror = (event) => console.log("failed to open indexeddb: ", event.errorCode);
  request.onsuccess = async () => {
    let db = request.result;
    for (const element of allElements) {
      // for each image tag within the html template..
      if (element.tagName === "IMG") {
        const currentSrc = element.getAttribute("src");
        const fr = new FileReader();
        // query the idb for that img and update the template
        let imgFile = await fetchImg(db, currentSrc);
        fr.onload = (event) => {
          element.src = event.target.result;
        };
        if (imgFile) {
          fr.readAsDataURL(imgFile);
        }
      }
    }
  };
}


function getPotionTemplate(id) {
  return `<div id="${id}">
            <div class="potion">
              <img src="back.png">
              <div class="juice"></div>
              <div class="under"></div>
              <img src="glass.png">
              <img src="body.png">
              <div class="amount"></div>
            </div>
            <div style="display: flex">
                <div class="drink">
                <input type="range" min="1" max="100" value="50" class="slider">
                <button class="drink-button">Drink</button>
              </div>
              <div class="dropdown">
                <div class="dropdown-icon"><strong>&#10247;</strong></div>
                <div class="dropdown-content">
                  <button class="transfer-button">Transfer</button>
                  <button class="delete-button">Delete</button>
                </div>
              </div>
            </div>
          </div>`
}

document.getElementsByClassName("inst-button")[0].addEventListener('click', () => issueOwnable());
document.getElementsByClassName("import-button")[0].addEventListener('click', () => importAssets());
