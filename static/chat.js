(function (vue) {
  var md = new markdownit();

  vue.filter('markdown', function (value) {
    return md.render(value);
  });

  var ChatMessage = vue.extend({
    props: ['message'],
    template: '#chat-message',
    ready: function () {
      this.$dispatch("chat-message-added", this.message);
    }
  });
  vue.component('chat-message', ChatMessage);

  var ChatLog = vue.extend({
    props: ['messages'],
    template: '#chat-messages',
    methods: {
      scrollToBottom: function () {
        this.$el.scrollTop = this.$el.scrollHeight;
      },
    },
  });
  vue.component('chat-log', ChatLog);

  var ChatCompose = vue.extend({
    template: '#chat-compose',
    data: function () {
      return {
        message: '',
      };
    },
    methods: {
      enterPressed: function () {
        var msg = this.message;
        this.$set('message', '');
        this.$dispatch('send-message', msg);
      },

      tabPressed: function () {
        var msg = this.$get('message');
        this.$set('message', msg+'  ');
      },
    },
  });
  vue.component('chat-compose', ChatCompose);

  var groupsLog = {};
  var vueApp = new vue({
    el: '#root',
    data: {
      currentGroup: {name: '', messages: []},
      isConnected: false,
    },
    ready: function (argument) {
      this.transport = new core.Transport();
      this.transport.events.on('connected', this.onConnected);
      this.transport.events.on('disconnected', this.onDisconnected);
      this.transport.events.on('message', this.onMessage);
      this.transport.events.on('joined', this.onJoin);
    },
    methods: {
      connect: function () {
        this.transport.connect();
      },

      sendMessage: function (msg) {
        this.transport.send(this.currentGroup.name, msg);
      },

      onMessage: function (m) {
        this.appendMessage(m);
      },

      onConnected: function () {
        this.$set('isConnected', true);
      },

      onDisconnected: function () {
        this.$set('isConnected', false);
      },

      onJoin: function (group) {
      },

      appendMessage: function (m) {
        groupsLog[m.to] = groupsLog[m.to] || [];

        if (!this.currentGroup.name) {
          this.$set('currentGroup.name', m.to);
          this.$set('currentGroup.messages', groupsLog[m.to]);
        }

        var grouplog = groupsLog[m.to];
        grouplog.push(m);

        if (this.currentGroup.name == m.to) {
          this.$broadcast('new-msg', m);
        }
      }
    },
  });

})(Vue);
