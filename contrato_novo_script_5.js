
        var cidlat = 0;
        var cidlon = 0;
        var fieldsPosLat = null;
        var fieldsPosLon = null;
        var bancos_disponiveis = [];

        function loadTenantWallets(idTenant) {
            const _idTenant = idTenant || 0;
            resetPlanos();

            $('#txt_carteira').html(new Option());
            $('#txt_carteira').attr('disabled', true);

            if (!idTenant) return;

            $.get(`/api/system/params/tenant/${_idTenant}/wallet/active`).done((data) => {
                const rows = JSON.parse(data) || [];
                rows.forEach(row => $('#txt_carteira').append(new Option(row.title, row.id)));
                if (rows.length) $('#txt_carteira').attr('disabled', false);
            });
        }

        function loadTenantNfeCom(idTenant) {
            if(!idTenant) return;

            $('#nfe_2x_tipo_lanc').on('change', function() {
                if ($(this).val() === 'other') {
                    $('#id_nfcom_preset').val(null).attr('disabled', true);
                } else {
                    $('#id_nfcom_preset').attr('disabled', false);
                }
            });

            $.get(`/api/nfcom/tenant/${idTenant}/conf/0`).done((data) => {
                const payload = JSON.parse(data) || {};
                $('#nfe_2x_tipo_lanc').html('<option></option>');
                $('#id_nfcom_preset').html('<option></option>');

                // Exibe conf
                if (payload.require_at_registration > 0 && payload.allowed_gen_type?.length > 0) {
                    
                    $('#nfcom-conf').show();

                    // Alimenta tipos
                    if (payload.allowed_gen_type.includes('auto')) $('#nfe_2x_tipo_lanc').append(new Option('Automática', 'auto'));
                    if (payload.allowed_gen_type.includes('manual')) $('#nfe_2x_tipo_lanc').append(new Option('Manual', 'manual'));
                    if (payload.allowed_gen_type.includes('other')) $('#nfe_2x_tipo_lanc').append(new Option('Outro Software', 'other'));

                    // Almenta presets
                    payload.presets.forEach(row => $('#id_nfcom_preset').append(new Option(row.title, row.id)));
                    $('#nfe_2x_tipo_lanc').trigger('change');

                } else {
                    $('#nfcom-conf').hide();
                }
            });
        }

        function validaFone(tipo, str = '') {

            var regexEmail = /\S+@\S+\.\S+/;

            switch (tipo) {
                case 'e':
                    if (!regexEmail.test(str)) {
                        swal('Ops!', 'Este email não é válido, ex: ispfy@gmail.com', 'error');
                        return false;
                    }
                    return true;
                    break;

                case 't':
                    var str = str.replace(/\D/g, '');

                    if (str.length != 10) {
                        swal('Ops!', 'O telefone deve conter 10 dígitos, ex: (44)1234-5678', 'error');
                        return false;
                    }

                    if (str.substring(0, 2) < 10) {
                        swal('Ops!', 'O DDD deve estar entre 10 e 99, ex: (44)1234-5678', 'error');
                        return false;
                    }

                    if (str.substring(2, 10) == '00000000') {
                        swal('Ops!', 'Este telefone não é válido, ex: (44)1234-5678', 'error');
                        return false;
                    }

                    return true;
                    break;

                case 'c':
                    var str = str.replace(/\D/g, '');

                    if (str.length != 11) {
                        swal('Ops!', 'O celular deve conter 11 dígitos, ex: (47)98765-2224', 'error');
                        return false;
                    }

                    if (str.substring(0, 2) < 10) {
                        swal('Ops!', 'O DDD deve estar entre 10 e 99, ex: (47)98765-2224', 'error');
                        return false;
                    }

                    if (str.substring(2, 10) == '00000000') {
                        swal('Ops!', 'Este celular não é válido, ex: (47)98765-2224', 'error');
                        return false;
                    }

                    return true;
                    break;
            }
        }

        function validaCepField(id_cidade, obj) {
            var str = obj.value;

            //Testa se é só número
            if (/[^0-9]+/.test(str)) {
                obj.focus();
                obj.backgroundColor = '#F66';
                swal('Erro no CEP', 'O campo CEP só pode conter números ou ficar vazio', 'error');
                return false;
            } else obj.backgroundColor = '';

            //Testa se é apenas zeros
            if (parseInt(str) == 0) {
                obj.focus();
                obj.backgroundColor = '#F66';
                swal('Erro no CEP', 'O campo CEP não pode conter apenas zeros', 'error');
                return false;
            } else obj.backgroundColor = '';


            //Testa se tem tamanho certo
            if (str.length != 8 && str.length != 0) {
                obj.focus();
                obj.backgroundColor = '#F66';
                swal('Erro no CEP', 'O campo CEP só pode conter 8 dígitos ou ficar vazio', 'error');
                return false;
            } else obj.backgroundColor = '';


            //Testa se não tem nada
            if (str.length == 0) {
                obj.backgroundColor = '#F66';
                swal({
                    confirmButtonText: 'Vou informar',
                    cancelButtonText: 'Use o automático',
                    cancelButtonColor: 'red',
                    showCancelButton: true,
                    title: 'CEP VAZIO',
                    html: '<b>Tem certeza que não deseja informar o CEP? </b><br>Um CEP Geral ou randômico será informado automaticamente, todavia isso poderá acarretar em problemas na emissão de remessas e notas fiscais futuramente.',
                    type: 'warning'
                }).then(function() {
                    obj.focus();
                }, function(result) {
                    if (result == 'cancel') {
                        $.get(window.location.pathname, {
                            getCepByCidadeId: id_cidade
                        }).done(function(data) {
                            obj.value = JSON.parse(data);
                        });
                    }
                });
                return false;
            } else obj.backgroundColor = '';

            return true;



        }

        function formatTelefone(element, e) {
            element.value = element.value.replace(/\D+/g, '');
            var oldMaxLen = element.maxLength;
            var length = element.value.length;
            var str = '';
            var posPrefix = null;

            if (oldMaxLen == 13)
                posPrefix = 6;
            if (oldMaxLen == 14)
                posPrefix = 7;

            if (length >= 10) {
                for (var i = 0; i < (oldMaxLen - 3); i++) {
                    if (i == 0)
                        str += '(';
                    else if (i == 2)
                        str += ')';
                    else if (i == posPrefix)
                        str += '-';

                    str += element.value.charAt(i);
                }
                element.value = str;
            }
        }

        function getBonusConta(obj) {
            if ($(obj).val() == 'auto') {
                $.get("contrato_novo.php", {
                    getBonusConta: true
                }).done(function(data) {
                    $('#txt_bonus').val(JSON.parse(data));
                });
            } else $('#txt_bonus').val(0);
        }

        function addContato(tipo = '', contato = '') {
            var table = document.getElementById("tbl_contatos");
            var rowcount = table.rows.length;
            var row = table.insertRow(rowcount - 1);
            var none_selected = '';
            var cel_selected = '';
            var tel_selected = '';
            var email_selected = '';
            var is_disabled = 'disabled';

            switch (tipo) {
                case 'e':
                    email_selected = 'selected';
                    is_disabled = '';
                    break;
                case 't':
                    tel_selected = 'selected';
                    is_disabled = '';
                    break;
                case 'c':
                    cel_selected = 'selected';
                    is_disabled = '';
                    break;
                default:
                    none_selected = 'selected';
                    break;
            }

            row.innerHTML = '<td height="34" align="left"><select name="txt_tipo_contato[]" class="txt21" style="height:24px; width:95%; padding-left:2px; border-radius:5px; background-color:#9CC; border:solid; border-width:0px;text-transform:uppercase; cursor:pointer;" onChange="setMaskContato(this)"><option  ' + none_selected + '></option><option value="e" ' + email_selected + '>EMAIL</option><option value="t" ' + tel_selected + '>TEL. FIXO</option><option value="c" ' + cel_selected + '>CELULAR</option></select></td><td height="34"><input name="txt_contato[]" value="' + contato + '" type="text" class="txt" autocomplete="off" style="height:24px; width:95%; padding-left:2px; border-radius:5px; border:solid; border-width:0px;"  maxlength="14" ' + is_disabled + ' max-length/></td><td align="center" valign="middle"><img src="../../iconmenu/sair.png" width="17" height="17"  style="cursor:pointer;" onClick="remContato(this)"/></td>';

            if (tipo == '')
                table.rows[rowcount - 1].cells[0].children[0].focus();
        }

        function remContato(obj) {
            var table = document.getElementById("tbl_contatos");
            var row = obj.parentNode.parentNode.rowIndex;
            var table = document.getElementById("tbl_contatos");
            var row = obj.parentNode.parentNode.rowIndex;
            table.deleteRow(row);

        }

        function setMaskContato(obj) {
            var table = document.getElementById("tbl_contatos");
            var row = obj.parentNode.parentNode.rowIndex;
            var txt_contato = table.rows[row].cells[1].children[0];
            txt_contato.value = '';
            if (obj.value == 't') {
                txt_contato.maxLength = 13;
                txt_contato.onblur = function(event) {
                    formatTelefone(txt_contato, event);
                };
                txt_contato.disabled = false;
                return;
            }

            if (obj.value == 'c') {
                txt_contato.maxLength = 14;
                txt_contato.onblur = function(event) {
                    formatTelefone(txt_contato, event);
                };
                txt_contato.disabled = false;
                return;
            }

            if (obj.value == 'e') {
                txt_contato.maxLength = 100;
                txt_contato.onblur = null;
                txt_contato.disabled = false;
                return;
            }

            txt_contato.disabled = true;


        }

        function getPos(elemID) {
            var offsetTrail = elemID;
            var offsetLeft = 0;
            var offsetTop = 0;
            while (offsetTrail) {
                offsetLeft += offsetTrail.offsetLeft;
                offsetTop += offsetTrail.offsetTop;
                offsetTrail = offsetTrail.offsetParent;
            }

            if (navigator.userAgent.indexOf("Mac") != -1 && typeof document.body.leftMargin != "undefined") {
                offsetLeft += document.body.leftMargin;
                offsetTop += document.body.topMargin;
            }
            return {
                left: offsetLeft,
                top: offsetTop
            };
        }

        function getOb(obj) {
            return document.getElementById(obj);
        }

        function SomenteNumero(e) {
            var tecla = (window.event) ? event.keyCode : e.which;
            if ((tecla > 47 && tecla < 58)) return true;
            else {
                if (tecla == 8 || tecla == 0) return true;
                else return false;
            }
        }

        function mascaraData(campoData) {
            var data = campoData.value;
            if (data.length == 2) {
                data = data + '/';
                campoData.value = data;
                return true;
            }
            if (data.length == 5) {
                data = data + '/';
                campoData.value = data;
                return true;
            }
        }

        function loadCityInstall(obj) {
            if (obj.value.length < 1) {
                $("#usersList").hide();
                return false;
            }

            $.get("/api/cidade", {
                nome: obj.value
            }).done(function(data) {

                if (parseInt($("#txt_id_cidade").val()) > 0)
                    return false;


                var dados = JSON.parse(data);
                if (dados == null) {
                    $("#usersList").hide();
                    $("#div_lista_item").hide();
                    return;
                }
                if (data.length > 0) {
                    $("#div_lista_item").show();
                    $("#usersList").show();
                    $("#usersList").html("");
                } else {
                    $("#usersList").hide();
                    $("#div_lista_item").hide();
                }

                $("#div_lista_item").css({
                    'left': getPos(obj).left,
                    'top': getPos(obj).top + 25
                });


                for (i = 0; i < dados.length; i++) {
                    var a = document.createElement("a");
                    a.setAttribute("class", "ponteiro");
                    a.setAttribute("title", dados[i].id);
                    a.innerHTML = dados[i].nome_uf;
                    a.coords = dados[i].lat;
                    a.rel = dados[i].lon;

                    a.onclick = function() {
                        $("#usersList").hide();
                        $("#div_lista_item").hide();
                        $("#mapFinder").show();
                        $("#txt_id_cidade").val(this.title);
                        obj.value = this.innerHTML;
                        cidlat = this.coords;
                        cidlon = this.rel;
                        return false;
                    }
                    a.onmouseover = function() {
                        this.style.backgroundColor = '#9CC';
                    };
                    a.onmouseout = function() {
                        this.style.backgroundColor = '';
                    };
                    document.getElementById("usersList").appendChild(a);
                }
            });


        }

        function validaDat(campo) {
            var date = campo.valor;
            var ardt = new Array;
            var ExpReg = new RegExp("(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[012])/[12][0-9]{3}");
            ardt = date.split("/");
            erro = false;
            if (date.search(ExpReg) == -1) {
                erro = true;
            } else if (((ardt[1] == 4) || (ardt[1] == 6) || (ardt[1] == 9) || (ardt[1] == 11)) && (ardt[0] > 30))
                erro = true;
            else if (ardt[1] == 2) {
                if ((ardt[0] > 28) && ((ardt[2] % 4) != 0))
                    erro = true;
                if ((ardt[0] > 29) && ((ardt[2] % 4) == 0))
                    erro = true;
            }
            if (erro) {
                swal('', valor + " não é uma data válida!", 'error');
                campo.focus();
                campo.value = "";
                return false;
            }
            return true;
        }

        function salvar_step1(gettab) {
            if (getOb('txt_nome_ponto').value == '') {
                $('#Tabs1').tabs({
                    active: 0
                });
                getOb('txt_nome_ponto').setAttribute("class", "txterr");
                getOb('txt_nome_ponto').focus();
                return false;
            } else getOb('txt_nome_ponto').setAttribute("class", "txt");


            if (getOb('txt_id_cidade').value == 0) {
                $('#Tabs1').tabs({
                    active: 0
                });
                getOb('txt_cidade').setAttribute("class", "txterr");
                getOb('txt_cidade').focus();
                return false;
            } else getOb('txt_cidade').setAttribute("class", "txt");

            if (!validaCepField(document.getElementById('txt_id_cidade').value, document.getElementById('txt_cep'))) {
                $('#Tabs1').tabs({
                    active: 0
                });
                return false;
            }

            if (getOb('txt_bairro').value.length < 4) {
                swal('Ops!', 'O campo BAIRRO precisa de pelo mínimo 4 caracteres', 'error');
                $('#Tabs1').tabs({
                    active: 0
                });
                getOb('txt_bairro').setAttribute("class", "txterr");
                getOb('txt_bairro').focus();
                return false;
            } else getOb('txt_bairro').setAttribute("class", "txt");

            if (getOb('txt_endereco').value.length < 4) {
                swal('Ops!', 'O campo ENDEREÇO precisa de pelo mínimo 4 caracteres', 'error');
                $('#Tabs1').tabs({
                    active: 0
                });
                getOb('txt_endereco').setAttribute("class", "txterr");
                getOb('txt_endereco').focus();
                return false;
            } else getOb('txt_endereco').setAttribute("class", "txt");

            if (getOb('txt_numero').value == '') {
                $('#Tabs1').tabs({
                    active: 0
                });
                getOb('txt_numero').setAttribute("class", "txterr");
                getOb('txt_numero').focus();
                return false;
            } else getOb('txt_numero').setAttribute("class", "txt");

            if (getOb('txt_complemento').value.length < 4) {
                swal('Ops!', 'O campo COMPLEMENTO precisa de pelo mínimo 4 caracteres', 'error');
                $('#Tabs1').tabs({
                    active: 0
                });
                getOb('txt_complemento').setAttribute("class", "txterr");
                getOb('txt_complemento').focus();
                return false;
            } else getOb('txt_complemento').setAttribute("class", "txt");

            if (getOb('txt_lat').value || getOb('txt_lon').value) {

                if (!parseInt(getOb('txt_lat').value) || parseInt(getOb('txt_lat').value) < -34 || parseInt(getOb('txt_lat').value) > 6) {
                    getOb('txt_lat').setAttribute("class", "txterr");
                    getOb('txt_lat').focus();
                    return false;
                } else getOb('txt_lat').setAttribute("class", "txt0");

                if (!parseInt(getOb('txt_lon').value) || parseInt(getOb('txt_lon').value) < -74 || parseInt(getOb('txt_lon').value) > -33) {
                    getOb('txt_lon').setAttribute("class", "txterr");
                    getOb('txt_lon').focus();
                    return false;
                } else getOb('txt_lon').setAttribute("class", "txt0");

            } else {
                getOb('txt_lat').setAttribute("class", "txt0");
                getOb('txt_lon').setAttribute("class", "txt0");
            }


            if (gettab) {
                $('#Tabs1').tabs({
                    active: 1
                });
                return false;
            }

            return true;
        }

        function salvar_step2(gettab) {
            var totalFones = 0;
            if (!salvar_step1(false))
                return false;

            for (i = 1; i < getOb('tbl_contatos').rows.length - 1; i++) {
                var campoContato = getOb('tbl_contatos').rows[i].cells[1].children[0];
                var campoTContato = getOb('tbl_contatos').rows[i].cells[0].children[0];

                if (!validaFone(campoTContato.value, campoContato.value)) {
                    $('#Tabs1').tabs({
                        active: 1
                    });
                    campoContato.focus();
                    campoContato.setAttribute("class", "txterr");
                    return false;
                } else campoContato.setAttribute("class", "txt");

                if (campoTContato.value == 't' && campoContato.value.length > 12)
                    totalFones++;

                if (campoTContato.value == 'c' && campoContato.value.length > 13)
                    totalFones++;
            }

            if (totalFones == 0) {
                $('#Tabs1').tabs({
                    active: 1
                });
                swal('', 'Cadastre pelo mínimo 1 telefone', 'error');
                return false;
            }
            if (gettab) {
                $('#Tabs1').tabs({
                    active: 2
                });
                return false;
            }

            return true;
        }

        function salvar_op1() {
            var totalRowSaved = 0;
            if (!salvar_step2(false))
                return false;

            if (parseInt(getOb('txt_tenant').selectedIndex || 0) < 1) {
                getOb('txt_tenant').setAttribute("class", "txterr");
                getOb('txt_tenant').focus();
                $('#Tabs1').tabs({
                    active: 3
                });
                return false;
            } else getOb('txt_tenant').setAttribute("class", "txt");


            if (parseInt(getOb('txt_carteira').selectedIndex || 0) < 1) {
                getOb('txt_carteira').setAttribute("class", "txterr");
                getOb('txt_carteira').focus();
                return false;
            } else getOb('txt_carteira').setAttribute("class", "txt");


            if (parseInt(getOb('txt_fidelidade').selectedIndex || 0) < 1) {
                getOb('txt_fidelidade').setAttribute("class", "txterr");
                getOb('txt_fidelidade').focus();
                return false;
            } else getOb('txt_fidelidade').setAttribute("class", "txt");

            if (parseInt(getOb('txt_eqp').selectedIndex || 0) < 1) {
                getOb('txt_eqp').setAttribute("class", "txterr");
                getOb('txt_eqp').focus();
                return false;
            } else getOb('txt_eqp').setAttribute("class", "txt");

            if (parseInt(getOb('txt_tipoins').selectedIndex || 0) < 1) {
                getOb('txt_tipoins').setAttribute("class", "txterr");
                getOb('txt_tipoins').focus();
                return false;
            } else getOb('txt_tipoins').setAttribute("class", "txt");

            var onlynumber = /^\d*$/;
            if (!onlynumber.test(getOb('txt_bonus').value)) {
                getOb('txt_bonus').setAttribute("class", "txterr");
                getOb('txt_bonus').focus();
                swal('', 'O bônus deve ser um número inteiro positivo', 'error');
                $('#Tabs1').tabs({
                    active: 3
                });
                return false;
            } else getOb('txt_bonus').setAttribute("class", "txt0");

            // VALIDA NO MINIMO UM SERVICO
            var totalRowSaved = 0;
            $("select[name*='txt_produto_tipo[]']").each(function() {
                if ($(this).val() == 'net') totalRowSaved++;
            });
            if (totalRowSaved == 0) {
                swal('', 'Cadastre um plano de internet', 'error');
                $('#Tabs1').tabs({
                    active: 3
                });
                return false;
            }


            //VERIFY UNSAVED ROW
            var stopScript = false;
            $("select[name*='txt_produto_tipo[]']").each(function() {
                if ($(this).is(":enabled")) {
                    stopScript = true;
                    $('#Tabs1').tabs({
                        active: 3
                    });
                    swal('', 'Existe plano sem salvar, verfique!', 'error');
                    return false;
                }
            });
            if (stopScript) return;



            if (parseInt(getOb('txt_especie').selectedIndex || 0) < 1) {
                getOb('txt_especie').setAttribute("class", "txterr");
                getOb('txt_especie').focus();
                return false;
            } else getOb('txt_especie').setAttribute("class", "txt");

            if (parseInt(getOb('txt_tipo_fat').selectedIndex || 0) < 1) {
                getOb('txt_tipo_fat').setAttribute("class", "txterr");
                getOb('txt_tipo_fat').focus();
                return false;
            } else getOb('txt_tipo_fat').setAttribute("class", "txt");

            if (parseInt(getOb('txt_faturamento').selectedIndex || 0) < 1) {
                getOb('txt_faturamento').setAttribute("class", "txterr");
                getOb('txt_faturamento').focus();
                return false;
            } else getOb('txt_faturamento').setAttribute("class", "txt");

            if ($('#nfe_2x_tipo_lanc').is(':visible')) {
                if (getOb('nfe_2x_tipo_lanc').selectedIndex == 0) {
                    getOb('nfe_2x_tipo_lanc').setAttribute("class", "txterr");
                    getOb('nfe_2x_tipo_lanc').focus();
                    return false;
                } else getOb('nfe_2x_tipo_lanc').setAttribute("class", "txt");


                if (getOb('nfe_2x_tipo_lanc').value == 'manual' || getOb('nfe_2x_tipo_lanc').value == 'auto') {

                    if (getOb('id_nfcom_preset').selectedIndex == 0) {
                        getOb('id_nfcom_preset').setAttribute("class", "txterr");
                        getOb('id_nfcom_preset').focus();
                        return false;
                    } else getOb('id_nfcom_preset').setAttribute("class", "txt");
                }
            }

            if (parseInt(getOb('id_doc_model').selectedIndex || 0) < 1) {
                getOb('id_doc_model').setAttribute("class", "txterr");
                getOb('id_doc_model').focus();
                return false;
            } else getOb('id_doc_model').setAttribute("class", "txt");

            if ((Number($("#txt_total_adesao").val().replace(',', '.'))) < 0) {
                swal('', 'O VALOR DA ADESÃO NÃO PODE SER NEGATIVO', 'error');
                return false;
            }
            if ((Number($("#txt_total_rescisao").val().replace(',', '.'))) < 0) {
                swal('', 'O VALOR DA RESCISÃO NÃO PODE SER NEGATIVO', 'error');
                return false;
            }
            if ((Number($("#txt_total_recorrente").val().replace(',', '.'))) < 0) {
                swal('', 'O VALOR RECORRENTE NÃO PODE SER NEGATIVO', 'error');
                return false;
            }



            swal({
                type: 'question',
                text: 'Salvar este cadastro com estes serviços?',
                showCancelButton: true,
                confirmButtonText: "Sim",
                cancelButtonText: "Não",
                reverseButtons: true
            }).then(function() {
                $('#txt_op').val('op2');
                $('#frmPostar').submit();

            });

        }

        function loadProdutos(boxtipo) {
            var tipo = boxtipo.value;
            var table = getOb('tbl_produtos');
            var row = boxtipo.parentNode.parentNode.rowIndex;
            var obj = getOb('tbl_produtos').rows[row].cells[1].children[0];

            getOb('tbl_produtos').rows[row].cells[2].children[0].value = '';
            getOb('tbl_produtos').rows[row].cells[3].children[0].value = '';
            getOb('tbl_produtos').rows[row].cells[4].children[0].value = '';
            getOb('tbl_produtos').rows[row].cells[5].children[0].value = '';
            $(getOb('tbl_produtos').rows[row].cells[6].children[0]).hide();

            if (!$("#txt_tenant").val() > 0) {
                swal('', 'Escolha a empresa resposável primeiro', 'error');
                boxtipo.value = '';
                return;
            }


            $.get("contrato_novo.php", {
                getProdutoByTipo: tipo,
                getProdutoProfile: $("#txt_profile").val(),
                getIdTenant: $("#txt_tenant").val()
            }).done(function(data) {
                var dados = JSON.parse(data);
                var option = document.createElement("OPTION");
                obj.innerHTML = "";
                obj.appendChild(option);
                for (i = 0; i < dados.length; i++) {
                    var option = document.createElement("OPTION");
                    option.innerHTML = dados[i][1];
                    option.value = dados[i][0];
                    obj.appendChild(option);
                }
                $(obj).attr('disabled', false);
            });
        }

        function loadProdutoDet(boxprod) {
            var prod = boxprod.value;
            var table = getOb('tbl_produtos');
            var row = boxprod.parentNode.parentNode.rowIndex;
            var txt_adesao = getOb('tbl_produtos').rows[row].cells[2].children[0];
            var txt_rescisao = getOb('tbl_produtos').rows[row].cells[3].children[0];
            var txt_valor = getOb('tbl_produtos').rows[row].cells[4].children[0];
            var txt_recor = getOb('tbl_produtos').rows[row].cells[5].children[0];
            var btn_salva = getOb('tbl_produtos').rows[row].cells[6].children[0];

            $.get("contrato_novo.php", {
                getProdutoById: prod
            }).done(function(data) {
                var dados = JSON.parse(data);
                if (parseInt(prod) > 0) {
                    txt_valor.value = dados[0];
                    txt_adesao.value = dados[1];
                    txt_rescisao.value = dados[2];
                    txt_recor.value = dados[3];
                    $(btn_salva).show();
                } else {
                    txt_valor.value = '';
                    txt_adesao.value = '';
                    txt_rescisao.value = '';
                    txt_recor.value = '';
                    $(btn_salva).hide();
                }

            });

        }

        function addItemProduto() {
            var table = document.getElementById("tbl_produtos");
            var rowcount = table.rows.length;
            var row = table.insertRow(rowcount - 2);
            row.innerHTML = '<tr><td height="24"><select name="txt_produto_tipo[]" class="prodnew"  style="height:20px; padding-left:2px; border-radius:5px; text-transform:uppercase; cursor:pointer;" onChange="loadProdutos(this);" ><option></option><option value="net">INTERNET</option><option value="sva">SERVIÇO</option><option value="sla">SLA</option></select></td><td><select disabled="disabled" name="txt_produto_item[]" class="prodnew" style="height:20px; padding-left:2px; border-radius:5px;   width:250px; text-transform:uppercase; cursor:pointer;" onChange="loadProdutoDet(this)" ><option></option></select><input type="hidden" name="txt_id_produto[]"></td><td><input type="text" class="txt1"   autocomplete="off" style="height:20px; width:60px; padding-left:2px; border-radius:5px;  border:solid; border-width:1px; border-color:#CCC; background-color:#F2F2F2; text-transform:uppercase; text-align:center;" readonly /></td><td><input  type="text" class="txt1" autocomplete="off" style="height:20px; width:60px; padding-left:2px; border-radius:5px;  border:solid; border-width:1px; border-color:#CCC; background-color:#F2F2F2; text-transform:uppercase; text-align:center;"  readonly/></td><td><input type="text" class="txt1"autocomplete="off" style="height:20px; width:60px; padding-left:2px; border-radius:5px;  border:solid; border-width:1px; border-color:#CCC; background-color:#F2F2F2; text-transform:uppercase; text-align:center;" readonly /></td><td align="center" valign="middle"><img src="../../iconmenu/sair.png" width="17" height="17"  style="cursor:pointer; display:block;" onclick="remProdutoItem(this)"/></td><td align="center" valign="middle"><img src="../../iconmenu/checado.png" width="17" height="17"  style="cursor:pointer; display: none;" onclick="salvaProdutoItem(this)"/></td></tr>';
        }

        function remProdutoItem(obj) {
            var table = document.getElementById("tbl_produtos");
            var row = obj.parentNode.parentNode.rowIndex;

            var table = document.getElementById("tbl_produtos");
            var row = obj.parentNode.parentNode.rowIndex;
            table.deleteRow(row);


            if (table.rows.length < 4) {
                $("#txt_desconto_adesao").val('0,00');
                $("#txt_desconto_rescisao").val('0,00');
                $("#txt_desconto_recorrente").val('');
            }

            calculaTotal();
        }

        function salvaProdutoItem(obj) {
            var table = document.getElementById("tbl_produtos");
            var row = obj.parentNode.parentNode.rowIndex;
            var stopScript = false;

            var boxTipoValor = table.rows[row].cells[0].children[0].value;
            var boxIdProdValor = table.rows[row].cells[1].children[0].value;
            table.rows[row].cells[1].children[1].value = boxIdProdValor;

            $("select[name*='txt_produto_tipo[]']").each(function() {
                if ($(this).is(":disabled") == true)
                    if ($(this).val() == boxTipoValor && boxTipoValor == 'net') {
                        stopScript = true;
                        swal('', 'Você não pode adicionar mais de um plano de internet!', 'error');
                    }
            });
            if (stopScript) return;

            $("select[name*='txt_produto_item[]']").each(function() {
                if ($(this).is(":disabled") == true)
                    if ($(this).val() == boxIdProdValor && boxTipoValor === 'sla') {
                        stopScript = true;
                        swal('', 'Você não pode adicionar o mesmo SLA duas vezes', 'error');
                    }
            });
            if (stopScript) return;





            //valida
            if ((table.rows[row].cells[0].children[0].selectedIndex || 0) == 0) {
                table.rows[row].cells[0].children[0].className = 'txterr';
                return;
            } else table.rows[row].cells[0].children[0].className = 'prodnew';

            if ((table.rows[row].cells[1].children[0].selectedIndex || 0) == 0) {
                table.rows[row].cells[1].children[0].className = 'txterr';
                return;
            } else table.rows[row].cells[1].children[0].className = 'prodnew';

            //SET PROPERTY
            table.rows[row].cells[0].children[0].className = 'prodsaved';
            table.rows[row].cells[0].children[0].disabled = true;
            table.rows[row].cells[0].children[0].style.cursor = 'default';
            table.rows[row].cells[1].children[0].className = 'prodsaved';
            table.rows[row].cells[1].children[0].disabled = true;
            table.rows[row].cells[1].children[0].style.cursor = 'default';
            table.rows[row].cells[6].children[0].style.display = 'none';

            table.rows[row].cells[2].children[0].setAttribute("name", "txt_produto_adesao[]");
            table.rows[row].cells[3].children[0].setAttribute("name", "txt_produto_rescisao[]");
            table.rows[row].cells[4].children[0].setAttribute("name", "txt_produto_recorrente[]");

            //soma
            calculaTotal();


        }

        function calculaTotal() {
            var divAdesao = 0.00;
            var totalAdesao = 0.00;
            var totalRescisao = 0.00;
            var totalRecorrente = 0.00;
            var totalAdesaoComDesconto = 0.00;
            var totalRescisaoComDesconto = 0.00;
            var totalRecorrenteComDesconto = 0.00;

            $("input[name*='txt_produto_adesao[]']").each(function() {
                totalAdesao += (Number($(this).val().replace(',', '.')));
            });
            $("input[name*='txt_produto_rescisao[]']").each(function() {
                totalRescisao += (Number($(this).val().replace(',', '.')));
            });
            $("input[name*='txt_produto_recorrente[]']").each(function() {
                totalRecorrente += (Number($(this).val().replace(',', '.')));
            });

            if ($("#txt_fidelidade").val() == 0 || $("#txt_fidelidade").val() == '')
                totalRescisao = 0.0;


            totalAdesaoComDesconto = totalAdesao + (Number($("#txt_desconto_adesao").val().replace(',', '.')));
            totalRescisaoComDesconto = totalRescisao + (Number($("#txt_desconto_rescisao").val().replace(',', '.')));
            totalRecorrenteComDesconto = totalRecorrente + (Number($("#txt_desconto_recorrente").val().replace(',', '.')));
            divAdesao = totalAdesaoComDesconto / Number($('#txt_parcelas').val()).toFixed(2);

            $("#lbl_parcela_adesao").val($('#txt_parcelas').val());
            $("#lbl_total_adesao").val(divAdesao.toFixed(2).replace('.', ','));
            $("#lbl_total_rescisao").val(totalRescisaoComDesconto.toFixed(2).replace('.', ','));
            $("#lbl_total_recorrente").val(totalRecorrenteComDesconto.toFixed(2).replace('.', ','));

            $("#txt_total_adesao").val(totalAdesao.toFixed(2).replace('.', ','));
            $("#txt_total_rescisao").val(totalRescisao.toFixed(2).replace('.', ','));
            $("#txt_total_recorrente").val(totalRecorrente.toFixed(2).replace('.', ','));

        }

        function setProfile(obj) {

            if ((obj.selectedIndex || 0) > 0) {
                $('#tbl_produtos').show();
                $('#tbl_set_perfil').hide();
            } else {
                $('#tbl_set_perfil').show();
                $('#tbl_produtos').hide();
            }

            resetPlanos();

        }

        function resetPlanos() {
            var table = document.getElementById("tbl_produtos");
            var rowcount = table.rows.length;
            for (var i = 1; i < rowcount - 2; i++)
                table.deleteRow(1);
        }

        function loadContactsFromAll() {
            var table = document.getElementById("tbl_contatos");
            var rowcount = table.rows.length;
            for (i = 0; i < rowcount - 2; i++) {
                table.deleteRow(1);
            }

            $.get("contrato_novo.php", {
                loadContactsFromAll: '2234'
            }).done(function(data) {
                $.each(JSON.parse(data), function(key, it) {
                    addContato(it.tipo, it.contato);
                });

            });
        }

        function loadAddressFromClient() {
            $.get("contrato_novo.php", {
                loadAddressFromClient: '2234'
            }).done(function(data) {
                var data = JSON.parse(data);
                if (data == -1) {
                    swal('', 'O endereço de cobrança não faz parte da área de cobertura, ou você não tem permissão para atuar nele.', 'error');
                    $("#mapFinder").hide();
                } else {
                    if (data.lat == 0) data.lat = '';
                    if (data.lon == 0) data.lon = '';


                    $('#txt_id_cidade').val(data.idcidade);
                    $('#txt_cidade').val(data.nomecidade);
                    $('#txt_cep').val(data.cep);
                    $('#txt_bairro').val(data.bairro);
                    $('#txt_endereco').val(data.endereco);
                    $('#txt_numero').val(data.numero);
                    $('#txt_complemento').val(data.complemento);
                    $('#txt_lat').val(data.lat);
                    $('#txt_lon').val(data.lon);
                    $("#mapFinder").show();


                }
            });
        }

        $(function() {

            loadTenantWallets();

            $("input[alt*='money']").maskMoney({
                thousands: '',
                decimal: ',',
                symbolStay: true,
                allowNegative: true
            });

            $("#Tabs1").tabs({
                active: 0
            });

            $('#txt_tenant').on('change', function() {
                loadTenantNfeCom($(this).val());
            }).trigger('change');
        });
    