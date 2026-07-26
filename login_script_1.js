
    new Vue({
        el: '#app',
        data() {
            return {
                searchParams: new URLSearchParams(window.location.search),
                loginUsername: window.localStorage.getItem('ispfy-username') || '',
                loginPassword: null,
                errorUsername: false,
                errorPassword: false,
                errorMessage: null,
                fLoginFullname: null,
                fLoginUsername: null,
                fLoginToken: null,
                fLoginPassword: null,
                fLoginpasswordConfirm: null,
                fErrorFullname: null,
                fErrorUsername: false,
                fErrorToken: false,
                fErrorPassword: false,
                fErrorPasswordConfrim: false,
                fErrorMessage: null,
                sending: false,
                loading: true,
                retrieveError: null,
                customerLogo: null,
                sourceAddress: null,
                customAdvertising: null,
                firstLogin: false,
                keepLogged: false
            }
        },
        computed: {
            showIspfyMiniLogo: function() {
                return this.customAdvertising ? true : false;
            },
            showSecureAlert: function() {
                return location.protocol === 'https:' ? false : true
            },
            cookieToken: function() {
                let a = `; ${document.cookie}`.match(`;\\s*keep=([^;]+)`);
                return a ? a[1] : '';
            },
            renewWindow: function() {
                return this.searchParams?.get('renew') === 'yes'
            },
            renewUsername: function() {
                return this.searchParams?.get('username')
            }
        },
        watch: {
            loginUsername: function(value) {
                if (value == '') {
                    window.localStorage.removeItem('ispfy-username');
                }
            }
        },
        created() {

            // refresh top window if loaded inside iframw without ahtorization
            if (window.self !== window.top && !this.renewWindow) {
                top.document.location = '/';
                return;
            }

            this.retriveData().then(() => {

                // skip login check when renew
                if (this.renewWindow) return;

                if (this.cookieToken) {
                    this.loginByCookie();
                } else {
                    this.loginBySession();
                }
            })
        },
        mounted() {
            document.getElementById('app').style.visibility = 'visible';
            Object.values(document.getElementsByTagName('input')).forEach(el => el.onpaste = () => !el.hasAttribute('no-paste'));
            this.focusLogin();
        },
        methods: {
            focusLogin: function() {
                setTimeout(() => {
                    if (this.loginUsername) {
                        this.$refs.loginPassword.focus()
                    } else {
                        this.$refs.loginUsername.focus()
                    }
                }, 300);
            },
            unb64: function(b64) {

                if (!b64) {
                    return null;
                }

                try {
                    return decodeURIComponent(window.atob(b64)) || null;
                } catch (error) {
                    return null;
                }
            },
            retriveData: function() {
                return axios.get(`?page-pre-load=1`).then(response => {
                    this.customerLogo = response.data.customerLogo;
                    this.sourceAddress = response.data.sourceAddress;
                    this.firstLogin = response.data.firstLogin;
                    this.customAdvertising = this.unb64(response.data.customAdvertising);
                }).catch(error => {
                    this.retrieveError = error.response.data;
                }).finally(() => {
                    this.loading = false;
                });
            },
            changeProtocol: function() {
                const hostname = window.location.hostname;
                window.location = `https://${hostname}:8443`;
            },
            loginByUsername: function($ev) {

                $ev.preventDefault();

                if (!this.loginUsername) {
                    this.$refs.loginUsername.focus();
                    this.errorUsername = true;
                    return false;
                } else {
                    this.errorUsername = false;
                }

                if (!this.loginPassword) {
                    this.$refs.loginPassword.focus();
                    this.errorPassword = true;
                    return false;
                } else {
                    this.errorPassword = false;
                }

                this.sending = true;

                this.doLogin(this.loginUsername, MD5(this.loginPassword), 'user').catch(error => {
                    this.loginPassword = null;
                    this.errorMessage = error;
                    setTimeout(() => this.$refs.loginPassword.focus(), 300);
                });

            },
            loginByCookie: function() {
                this.sending = true;
                this.keepLogged = true;
                this.loginPassword = '*******';
                this.doLogin('', '', 'cookie').catch(error => {
                    this.loginUsername = '';
                    this.loginPassword = '';
                    this.errorMessage = error;
                })
            },
            loginBySession: function() {
                this.sending = true;
                this.doLogin('', '', 'session')
                    .catch(() => {
                        this.sending = false;
                    })
            },
            doLogin: function(username, password, type) {

                this.errorMessage = null;

                return axios.post('', {
                    login: type,
                    username: username,
                    password: password,
                    keep: this.keepLogged
                }).then(response => {
                    window.localStorage.setItem('ispfy-username', this.loginUsername);
                    window.localStorage.setItem('roles', window.btoa(response.data.roles));
                    window.localStorage.setItem('id_group', response.data.id_group);

                    if (this.renewWindow) {
                        if (this.renewUsername === this.loginUsername) {
                            setTimeout(() => top.showRenewLoginWindow(false), 300);
                            return;
                        }

                        top.location = '/home/main.php';
                    }

                    document.location = '/home/main.php';

                }).catch(error => {
                    this.sending = false;
                    window.localStorage.removeItem('roles');
                    window.localStorage.removeItem('id_group');
                    return Promise.reject(error.response.data);
                }).finally(() => {
                    setTimeout(() => this.sending = false, 2000);
                    setTimeout(() => this.errorMessage = null, 6000);
                });

            },
            createFirstLogin: function($ev) {

                $ev.preventDefault();

                if ((this.fLoginFullname || '').split(' ').length < 2) {
                    this.$refs.fLoginFullname.focus();
                    this.fErrorFullname = true;
                    this.fErrorMessage = 'Prencha com seu nome completo';
                    return false;
                } else {
                    this.fErrorFullname = false;
                    this.fErrorMessage = null;
                }

                if ((this.fLoginUsername || '').length < 6) {
                    this.$refs.fLoginUsername.focus();
                    this.fErrorUsername = true;
                    this.fErrorMessage = 'O usuário precisa de pelo menos 6 caractéres';
                    return false;
                } else {
                    this.fErrorUsername = false;
                    this.fErrorMessage = null;
                }

                if (/[^0-9a-z]/.test(this.fLoginUsername || '')) {
                    this.$refs.fLoginUsername.focus();
                    this.fErrorUsername = true;
                    this.fErrorMessage = 'O usuário pode conter apenas letras minusculas e números';
                    return false;
                } else {
                    this.fErrorUsername = false;
                    this.fErrorMessage = null;
                }

                if (!this.fLoginToken) {
                    this.$refs.fLoginToken.focus();
                    this.fErrorToken = true;
                    return false;
                } else {
                    this.fErrorToken = false;
                }

                if ((this.fLoginPassword || '').length < 6) {
                    this.$refs.fLoginPassword.focus();
                    this.fErrorPassword = true;
                    this.fErrorMessage = 'A senha precisa de pelo menos 6 caractéres';
                    return false;
                } else {
                    this.fErrorPassword = false;
                    this.fErrorMessage = null;
                }

                if (!this.fLoginpasswordConfirm) {
                    this.$refs.fLoginpasswordConfirm.focus();
                    this.fErrorPasswordConfrim = true;
                    return false;
                } else {
                    this.fErrorPasswordConfrim = false;
                }

                if (this.fLoginPassword !== this.fLoginpasswordConfirm) {
                    this.fErrorMessage = 'As senhas não são iguais';
                    this.fErrorPassword = true;
                    this.fErrorPasswordConfrim = true;
                    return false;
                } else {
                    this.fErrorMessage = null;
                    this.fErrorPassword = false;
                    this.fErrorPasswordConfrim = false;
                }

                axios.post('', {
                    createLogin: 1,
                    name: this.fLoginFullname,
                    username: this.fLoginUsername,
                    token: MD5(this.fLoginToken),
                    password: MD5(this.fLoginPassword),
                    passwordConfirm: MD5(this.fLoginpasswordConfirm),
                }).then(response => {
                    this.firstLogin = false;
                    this.loginUsername = this.fLoginUsername;
                    this.loginPassword = this.fLoginPassword;
                }).catch(error => {
                    this.sending = false;
                    this.fErrorMessage = error.response.data;
                }).finally(() => {
                    this.sending = false;
                    setTimeout(() => this.fErrorMessage = null, 6000);
                });
            }
        }
    });
