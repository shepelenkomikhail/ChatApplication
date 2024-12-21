const form = document.getElementById('form');
const input = document.getElementById('input');

const socket = io({
    auth: { serverOffset: 0 },
    ackTimeout: 10000,
    retries: 3,
});

let counter = 0;

function submitForm(e) {
    e.preventDefault();
    if (input.value) {
        const clientOffset = `${socket.id}-${counter++}`;
        socket.emit('chat message', input.value, clientOffset);
        input.value = '';
    }
    input.style.height = '64px';
}

form.addEventListener('submit', (e) => {submitForm(e);});

function deleteRequest() {
    fetch(`/`, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
    })
        .then(response => {
            if (response.ok) {
                console.log('Message deleted successfully');
                location.reload(true);
            } else {console.error('Failed to delete message');}
        })
        .catch(error => {console.error('Error:', error);});
}

window.addEventListener('beforeunload', (event) => {deleteRequest();});

input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {submitForm(e);}
});

input.addEventListener('input', function () {
    if (this.value.length < 50) {
        this.style.height = '64px';
    } else {
        this.style.height = 'auto';
        this.style.height = `${this.scrollHeight}px`;
    }
});

socket.on('chat message', (msg, serverOffset, senderId) => {
    const item = document.createElement('li');
    item.textContent = msg;

    if (senderId === socket.id) {
        item.className = "p-3 m-2 rounded-xl bg-[rgb(48,48,48)] text-left ml-auto w-fit max-w-[60%] break-words";
    } else {
        item.className = "p-3 m-2 rounded-xl bg-[rgb(48,48,48)] text-left mr-auto w-fit max-w-[60%] break-words";
    }

    socket.auth.serverOffset = serverOffset;
});