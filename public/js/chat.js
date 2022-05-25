const {createApp} = Vue


function clamp(a, mi, mx) {
    return Math.min(Math.max(mi, a), mx);
}

createApp({
    data() {
        return {
            socket: null, msgText: '', messages: {}, currentChannel: '',
                channels: [], subscribeChannelField: '', channelState: {},
                scrollY: 0, my_name: '', sidePaneVisible: true, lastTouchY: 0,
                connected: false
        }
    },

    computed: {
        currentMessages() {
            return this.messages[this.currentChannel];
        },
        state() {
            return this.channelState[this.currentChannel];
        },
    },

    methods: {
        send(e) {
            e.preventDefault();
            this.socket.send(JSON.stringify(
                {msg: {text: this.msgText, channel: this.currentChannel}}));
            this.msgText = '';
        },
        deleteMessage(id) {
            this.socket.send(JSON.stringify({delete: {id}}));
            this.msgText = '';
        },
        makeConnection() {
            this.socket = new WebSocket(`${location.protocol == 'https:' ? 'wss:' : 'ws:'}//${location.host}`);

            this.socket.addEventListener('open', () => {
                this.messages = {};
                this.channelState = {};
                this.scrollY = 0;

                this.connected = true;

                this.loadPreviousMessages();
            });

            this.socket.addEventListener('message', async (event) => {
                const data = await JSON.parse(event.data);

                if (data.msg) {
                    console.log(data.msg);
                    if (!this.messages[data.msg.channel])
                        this.messages[data.msg.channel] = [];
                    this.messages[data.msg.channel].push(data.msg);

                    this.markUnread(data.msg.channel);
                }
                if (data.append) {
                    if (!this.messages[data.append.channel])
                        this.messages[data.append.channel] = [];
                    this.messages[data.append.channel] = [
                        ...this.messages[data.append.channel],
                        ...data.append.messages
                    ];
                    this.markUnread(data.append.channel);
                    this.channelState[data.append.channel] = 'standby';
                }
                if (data.prepend) {
                    if (!this.messages[data.prepend.channel])
                        this.messages[data.prepend.channel] = [];

                    if (data.prepend.messages.length) {
                        this.messages[data.prepend.channel] = [
                            ...data.prepend.messages,
                            ...this.messages[data.prepend.channel]
                        ];
                        this.markUnread(data.prepend.channel);
                        this.channelState[data.prepend.channel] = 'standby';
                    } else {
                        this.channelState[data.prepend.channel] = 'full';
                    }
                }

                if (data.delete) {
                    if (this.messages[data.delete.channel]) {
                        this.messages[data.delete.channel] =
                            this.messages[data.delete.channel].filter(
                                m => m.id != data.delete.id);
                    }
                }
            });

            this.socket.addEventListener(
                'close', () => {
					setTimeout(this.makeConnection, 500);
					this.connected = false;
				});
        },
        markUnread(chann, val = true) {
            if (this.currentChannel == chann && val == true) return;
            for (let i = 0; i < this.channels.length; i++)
                if (this.channels[i].name == chann) {
                    this.channels[i].unread = val;
                    break;
                }
        },
        loadPreviousMessages() {
            if (!this.currentChannel) return;
            if (this.channelState[this.currentChannel] == 'full' ||
                this.channelState[this.currentChannel] == 'loading')
                return;
            message = {};
            message.fetch = {};
            if (this.messages[this.currentChannel] &&
                this.messages[this.currentChannel].length) {
                message.fetch.before = this.messages[this.currentChannel][0].id;
            } else {
                message.fetch.newest = true;
            }
            message.fetch.channel = this.currentChannel;
            this.socket.send(JSON.stringify(message));
            this.channelState[this.currentChannel] = 'loading';
        },
        changeChannel(chann) {
            this.currentChannel = chann;
            this.markUnread(chann, false);

            if (!this.messages[chann]) this.loadPreviousMessages();

            this.scrollY = 0;
        },
        subscribeChannel(e) {
            e.preventDefault();


            if (!this.channels.some(
                    c => c.name == this.subscribeChannelField)) {
                this.channels.push({name: this.subscribeChannelField});
                this.socket.send(
                    JSON.stringify({subscribe: this.subscribeChannelField}));
            }
            this.changeChannel(this.subscribeChannelField);

            this.subscribeChannelField = '';
        },
        unsubscribeChannel(chann) {
            this.socket.send(JSON.stringify({unsubscribe: chann}));

            this.channels = this.channels.filter(c => c.name != chann);

            if (chann == this.currentChannel) {
                this.currentChannel = null;
            }
        },
        messageFieldKey(e) {
            if (e.key == 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (this.msgText) this.send(e);
            }
        },
        scrolled(e) {
            if (!this.currentChannel) return;
            this.scrollY = clamp(
                this.scrollY + e.deltaY, -this.$refs.msgCont.scrollHeight + 500,
                0);

            if (-this.scrollY >= this.$refs.msgCont.scrollHeight - 600) {
                this.loadPreviousMessages();
            }
        },
        touchstarted(e) {
            this.lastTouchY = e.touches[0].pageY;
        },
        touchdragged(e) {
            if (!this.currentChannel) return;
            const delta = e.changedTouches[0].pageY - this.lastTouchY;
            this.scrollY = clamp(
                this.scrollY - delta, -this.$refs.msgCont.scrollHeight + 500,
                0);

            if (-this.scrollY >= this.$refs.msgCont.scrollHeight - 600) {
                this.loadPreviousMessages();
            }
            this.lastTouchY = e.changedTouches[0].pageY;
        },
        toggleSidePane() {
            this.sidePaneVisible = !this.sidePaneVisible;
        }
    },

    mounted() {
        this.makeConnection();

        this.channels = INIT_CHANN_LIST.map(n => {
            return {
                name: n, unread: false
            }
        });

        this.my_name = MY_NAME;

        this.currentChannel = this.channels[0].name;


		document.body.style.height = "100vh";
    }
}).mount('#app');

