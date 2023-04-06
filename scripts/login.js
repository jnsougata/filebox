function handleStartup(key) {
    globalSecretKey = key;
    globalProjectId = globalSecretKey.split('_')[0];
    globalUserId = /-(.*?)\./.exec(window.location.hostname)[1];  // issues in custom domains
    document.querySelector('#username').innerHTML = globalUserId
    fetch("/api/consumption")
    .then(response => response.json())
    .then(data => {
        updateSpaceUsage(data.size);
    })
    modal.style.display = 'none';
    homeButton.click();
    fetch(`/api/discovery/${globalUserId}/status`)
    .then((resp) => resp.json())
    .then((data) => {
        globalDiscoveryStatus = data.status;
        if (data.status === -1) {
            discoveryButton.style.color = colorOrange;
        } else if (data.status === 0) {
            discoveryButton.style.color = colorRed;
        } else if (data.status === 1) {
            discoveryButton.style.color = colorGreen;
        }
    })
}

function buildLoginModal() {
    let modal = document.createElement('div');
    modal.className = 'pin_entry';
    let header = document.createElement('header');
    let img = document.createElement('img');
    img.src = '../assets/icon.png';
    let p = document.createElement('p');
    p.innerHTML = 'Filebox';
    header.appendChild(img);
    header.appendChild(p);
    let input = document.createElement('input');
    input.type = 'password';
    input.placeholder = 'Enter password';
    input.focus();
    input.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            enter.click();
        }
    });
    let enter = document.createElement('span');
    enter.className = 'material-symbols-rounded';
    enter.innerHTML = 'arrow_forward';
    enter.addEventListener('click', () => {
        if (!input.value) {
            showSnack('Please enter a password', colorOrange, 'info');
            return;
        }
        if (input.value.length < 6) {
            showSnack('Password must be at least 6 characters long', colorOrange, 'info');
            return;
        }
        fetch(`/api/key/${input.value}`)
        .then(response => {
            if (response.status === 200) {
                localStorage.setItem("password", input.value)
                globalUserPassword = input.value;
                return response.json();
            } else if (response.status === 404) {
                showSnack('You did not set any Password, check App Config.', colorOrange, 'info');
                return null;
            }  else if (response.status === 403) {
                showSnack('Wrong Password, try again.', colorRed, 'info');
                return null;
            } else {
                showSnack('Something went wrong, try again.', colorOrange, 'info');
                return null;
            }
        })
        .then(data => {
            if (!data) {
                return;
            }
            modal.style.display = 'none';
            handleStartup(data.key);
        })
    });
    let div = document.createElement('div');
    let a = document.createElement('a');
    a.href = 'https://filebox-1-q0603932.deta.app/api/embed/a5f6a03facf0f28c';
    a.innerHTML = 'How to add or reset password?';
    div.appendChild(a);
    let footer = document.createElement('footer');
    let span = document.createElement('span');
    span.innerHTML = 'USER_PIN has been changed to USER_PASSWORD and must be at least 6 characters long.';
    footer.appendChild(span);
    modal.appendChild(header);
    modal.appendChild(input);
    modal.appendChild(enter);
    modal.appendChild(div);
    modal.appendChild(footer);
    return modal;
}