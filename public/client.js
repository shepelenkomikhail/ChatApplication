const form = document.getElementById('form');
const input = document.getElementById('input');
const message = document.getElementById('messages');
const deleteVar = document.getElementById('delete');

const socket = io({
    auth: { serverOffset: 0 },
    ackTimeout: 10000,
    retries: 3,
});

let counter = 0;

form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value) {
        const clientOffset = `${socket.id}-${counter++}`;
        socket.emit('chat message', input.value, clientOffset);
        input.value = '';
    }
});

function deleteRequest() {
    fetch(`/`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
    })
        .then(response => {
            if (response.ok) {
                console.log('Message deleted successfully');
                location.reload(true);
            } else {
                console.error('Failed to delete message');
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

deleteVar.addEventListener('click', () => {
    deleteRequest();
});

window.addEventListener('beforeunload', (event) => {
    deleteRequest();
});


socket.on('chat message', (msg, serverOffset, senderId) => {
    const item = document.createElement('li');
    item.textContent = msg;

    if (senderId === socket.id) {
        item.className = "p-3 m-2 rounded-xl bg-[rgb(48,48,48)] text-right ml-auto w-fit";
    } else {
        item.className = "p-3 m-2 rounded-xl bg-[rgb(48,48,48)] text-left mr-auto w-fit";
    }

    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;

    socket.auth.serverOffset = serverOffset;
});