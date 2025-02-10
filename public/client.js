import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";

const form = document.getElementById('form');
const input = document.getElementById('input');
const messagesList = document.getElementById('messages');
const deleteButton = document.getElementById('delete');

const socket = io("http://localhost:3000", {
    transports: ["websocket"], // ✅ Forces WebSockets to avoid polling issues
    auth: { serverOffset: 0 },
    ackTimeout: 20000,
    retries: 3,
});

let counter = 0;

function submitForm(e) {
    e.preventDefault();
    if (input.value) {
        const clientOffset = `${socket.id}-${counter++}`;
        console.log(input.value, clientOffset);

        socket.emit('chat message', input.value, clientOffset, (response) => {
            console.log(input.value, clientOffset);
            console.log('Message sent callback:', response);

            if (response) {
                if (response.success) {
                    console.log("✅ Message confirmed by server:", response.message);
                } else {
                    console.error("❌ Server error:", response.message);
                }
            } else {
                console.error("❌ Message was not acknowledged (null response). Possible server issue.");
            }
        });


        input.value = '';
    }
    input.style.height = '64px';
}

form.addEventListener('submit', (e) => { submitForm(e); });

function deleteRequest() {
    fetch("http://localhost:3000/", {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
    })
        .then(response => {
            if (response.ok) {
                console.log('Messages deleted successfully');
                messagesList.innerHTML = '';
            } else {
                console.error('Failed to delete messages');
            }
        })
        .catch(error => { console.error('Error:', error); });
}

deleteButton.addEventListener('click', () => {
    deleteRequest();
});

window.addEventListener('beforeunload', (event) => { deleteRequest(); });

input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { submitForm(e); }
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

    messagesList.appendChild(item);

    socket.auth.serverOffset = serverOffset;
    socket.disconnect();
    socket.connect();
});

