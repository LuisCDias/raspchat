/*
Copyright (c) 2015 Zohaib
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

(function (vue) {
  var md = new markdownit();

  vue.filter('markdown', function (value) {
    return md.render(value);
  });

  vue.component('chat-message', vue.extend({
    props: ['message'],
    template: '#chat-message',
    ready: function () {
      this.$dispatch("chat-message-added", this.message);
    }
  }));

  vue.component('chat-log', vue.extend({
    props: ['messages'],
    template: '#chat-messages',
    methods: {
      scrollToBottom: function () {
        this.$el.scrollTop = this.$el.scrollHeight;
      },
    },
  }));

  vue.component('chat-compose', vue.extend({
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
  }));

  vue.component('app-bar', vue.extend({
    template: '#app-bar',
    data: function () {
      return {
        sound: false
      };
    },
    methods: {
    }
  }));

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
      this.transport.events.on('switch', this.onSwitch);
    },

    methods: {
      connect: function () {
        this.transport.connect();
      },

      sendMessage: function (msg) {
        if (this.currentGroup.name == this.defaultGroup && msg[0] != "/"){
          this.appendMetaMessage(
            "You can only send a command here ...\n"+
            "Valid commands are: \n"+
            "/join <group_name> to join a group\n"+
            "/nick <new_name> for changing your nick\n"+
            "/switch <group_name> to switch to a joined group\n"
          );
          return;
        }

        this.transport.send(this.currentGroup.name, msg);
      },

      onMessage: function (m) {
        if (!this.defaultGroup) {
          this.defaultGroup = m.from;
        }

        this.appendMessage(m);
      },

      onConnected: function () {
        this.$set('isConnected', true);
        this.$broadcast("connection:on");
      },

      onDisconnected: function () {
        this.$set('isConnected', false);
        this.$broadcast("connection:off");
      },

      onJoin: function (joinInfo) {
        groupsLog[joinInfo.to] = groupsLog[joinInfo.to] || [];
        this.$broadcast("group:joined", joinInfo);
      },

      onSwitch: function (group) {
        if (!groupsLog[group]) {
          alert('You have not joined group '+group);
          return;
        }

        this.$set('currentGroup.name', group);
        this.$set('currentGroup.messages', groupsLog[group]);
        this.$broadcast("group:switched", group);
      },

      appendMessage: function (m) {
        groupsLog[m.to] = groupsLog[m.to] || [];

        if (!this.currentGroup.name) {
          this.$set('currentGroup.name', m.to);
          this.$set('currentGroup.messages', groupsLog[m.to]);
        }

        var grouplog = groupsLog[m.to];
        grouplog.push(m);
        this.$broadcast('message:new', m);
      },

      appendMetaMessage: function (msg) {
        this.currentGroup.messages.push({isMeta: true, msg: msg});
      }
    },
  });

})(Vue);
