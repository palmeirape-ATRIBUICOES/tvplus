
            var cidlat = 0;
            var cidlon = 0;
            var cidlatCob = 0;
            var cidlonCob = 0;
            var fieldsPosLat = null;
            var fieldsPosLon = null;
            var bancos_disponiveis = [];

            function customAlert(text){
                swal('', text, 'warning');
            }

            function validaFone(tipo, str = ''){

                var regexEmail = /\S+@\S+\.\S+/;

                switch(tipo){
                    case 'e':
                        if(!regexEmail.test(str)){
                            swal('Ops!','Este email não é válido, ex: ispfy@gmail.com','error');
                            return false;
                        }
                        return true;
                    break;

                    case 't':
                        var str = str.replace(/\D/g,'');

                        if(str.length != 10){
                            swal('Ops!','O telefone deve conter 10 dígitos, ex: (44)1234-5678','error');
                            return false;
                        }

                        if(str.substring(0,2) < 10){
                            swal('Ops!','O DDD deve estar entre 10 e 99, ex: (44)1234-5678','error');
                            return false;
                        }

                        if(str.substring(2,10) == '00000000'){
                            swal('Ops!','Este telefone não é válido, ex: (44)1234-5678','error');
                            return false;
                        }

                        return true;
                    break;

                    case 'c':
                        var str = str.replace(/\D/g,'');

                        if(str.length != 11){
                            swal('Ops!','O celular deve conter 11 dígitos, ex: (47)98765-2224','error');
                            return false;
                        }

                        if(str.substring(0,2) < 10){
                            swal('Ops!','O DDD deve estar entre 10 e 99, ex: (47)98765-2224','error');
                            return false;
                        }

                        if(str.substring(2,10) == '00000000'){
                            swal('Ops!','Este celular não é válido, ex: (47)98765-2224','error');
                            return false;
                        }

                        return true;
                    break;
                }
            }

            function getBonusConta(obj){
            if($(obj).val() == 'auto'){
                $.get("easycad.php", {getBonusConta:true}).done(function( data ) {
                    $('#txt_bonus').val(JSON.parse(data));
                });
            } else $('#txt_bonus').val(0);
            }

            function valiTipoEnd(obj){
            if(obj.value == 'ins'){
                $('#tbl_end_ins').show();
                $('#tbl_cob_dif').hide();
                $('#spnContatoAvancar').show();
                $('[href="#tabs-5"]').closest('li').show();
            };
            if(obj.value == 'cobins'){
                $('#tbl_end_ins').show();
                $('#tbl_cob_dif').show();
                $('#spnContatoAvancar').show();
                $('[href="#tabs-5"]').closest('li').show();
            }


            }

            function valData(obj){
            var data = obj.value;
                var dia = data.substring(0,2)
                var b1 = data.substring(2,3)
            var mes = data.substring(3,5)
                var b2 = data.substring(5,6)
            var ano = data.substring(6,10)

            if(b1 != '/' || b2 != '/')
                return false;

                //Criando um objeto Date usando os valores ano, mes e dia.
                var novaData = new Date(ano,(mes-1),dia);

                var mesmoDia = parseInt(dia,10) == parseInt(novaData.getDate());
                var mesmoMes = parseInt(mes,10) == parseInt(novaData.getMonth())+1;
                var mesmoAno = parseInt(ano) == parseInt(novaData.getFullYear());

                if (!((mesmoDia) && (mesmoMes) && (mesmoAno)))
                {

                    return false;
                }
                return true;
            }

            function validaCgcExiste(cgc, enviar){
                $('#img_load').show();
                $('#btn_salvar').hide();

                $.get("instalacao_cadastrar.php", {cgc: cgc}).done(function(data){

                    var dados = JSON.parse(data);

                    if(dados.status == true){
                        getOb('txt_cgc').setAttribute("class", "txterr");
                        $('#img_load').hide();
                        $('#btn_salvar').show();
                        $('#Tabs1').tabs({active:0});
                        $('#txt_cgc').val('');
                        swal({
                            type: 'warning',
                            html: '<span>Cpf/Cnpj já cadastrado para<br/><b><a href="../sis_cobrancas/detalhes.php?cliente='+dados.id+'">'+dados.nome+'</a></b></span><br/>'
                        });

                    } else if(enviar) $('#frmPostar').submit();
                });
            }

            function validaPppExiste(ppp, cbk_ok, cbk_err){
            $.get("easycad.php", {get_ppp: ppp }).done(function( data ) {
                if(JSON.parse(data) == true){
                cbk_err();
                } else cbk_ok();
            });
            }

            function formatTelefone(element,e){
                element.value = element.value.replace(/\D+/g,'');
                var oldMaxLen = element.maxLength;
                var length = element.value.length;
                var str = '';
                var posPrefix = null;

                if(oldMaxLen == 13)
                posPrefix = 6;
                if(oldMaxLen == 14)
                posPrefix = 7;

                if(length >= 10){
                for (var i = 0; i < (oldMaxLen-3); i++) {
                if(i == 0)
                    str += '(';
                else if(i == 2)
                    str += ')';
                else if(i == posPrefix)
                    str += '-';

                str += element.value.charAt(i);
                }
                element.value = str;
            }
            }

            function addContato(){
            var table = document.getElementById("tbl_contatos");
            var rowcount = table.rows.length;
            var row = table.insertRow(rowcount -1);



            row.innerHTML = '<td height="34" align="left"><select name="txt_tipo_contato[]" class="txt21" style="height:24px; width:95%; padding-left:2px; border-radius:5px; background-color:#9CC; border:solid; border-width:0px;text-transform:uppercase; cursor:pointer;" onChange="setMaskContato(this)"><option selected="selected"></option><option value="e">EMAIL</option><option value="t">TEL. FIXO</option><option value="c">CELULAR</option></select></td><td height="34"><input name="txt_contato[]" type="text" class="txt" autocomplete="off" style="height:24px; width:95%; padding-left:2px; border-radius:5px; border:solid; border-width:0px;"  maxlength="14" disabled max-length/></td><td align="center" valign="middle"><img src="../iconmenu/sair.png" width="17" height="17"  style="cursor:pointer;" onClick="remContato(this)"/></td>';

            table.rows[rowcount-1].cells[0].children[0].focus();
            }

            function remContato(obj){
            var table =  document.getElementById("tbl_contatos");
            var row = obj.parentNode.parentNode.rowIndex;
            var table =  document.getElementById("tbl_contatos");
            var row = obj.parentNode.parentNode.rowIndex;
            table.deleteRow(row);

            }

            function setMaskContato(obj){
            var table =  document.getElementById("tbl_contatos");
            var row = obj.parentNode.parentNode.rowIndex;
            var txt_contato = table.rows[row].cells[1].children[0];
            txt_contato.value = '';
            if(obj.value == 't'){
                txt_contato.maxLength = 13;
                txt_contato.onblur = function(event){
                    formatTelefone(txt_contato,event);
                };
                txt_contato.disabled = false;
                return;
            }

            if(obj.value == 'c'){
                txt_contato.maxLength = 14;
                txt_contato.onblur = function(event){
                    formatTelefone(txt_contato,event);
                };
                txt_contato.disabled = false;
                return;
            }

            if(obj.value == 'e'){
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
                while(offsetTrail) {
                    offsetLeft += offsetTrail.offsetLeft;
                    offsetTop += offsetTrail.offsetTop;
                    offsetTrail = offsetTrail.offsetParent;
                }

                if(navigator.userAgent.indexOf("Mac") != -1 && typeof document.body.leftMargin != "undefined") {
                    offsetLeft += document.body.leftMargin;
                    offsetTop += document.body.topMargin;
                }
                return {
                    left: offsetLeft,
                    top: offsetTop
                };
            }

            function getOb(obj){
            return document.getElementById(obj);
            }

            function SomenteNumero(e){
                var tecla=(window.event)?event.keyCode:e.which;
                if((tecla>47 && tecla<58)) return true;
                else{
                if (tecla==8 || tecla==0) return true;
            else  return false;
                }
            }

            function mascaraData(campoData){
            var data = campoData.value;
                        if (data.length == 2){
                            data = data + '/';
                            campoData.value = data;
                return true;
                        }
                        if (data.length == 5){
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

                    if(parseInt($("#txt_id_cidade").val()) > 0) return false;

                    var dados = JSON.parse(data);
                    if(dados == null){
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

                    $("#div_lista_item").css({'left':getPos(obj).left, 'top':getPos(obj).top + 25});

                    for(i = 0; i < dados.length; i++){
                        var a = document.createElement("a");
                        a.setAttribute("class", "ponteiro");
                        a.setAttribute("title", dados[i].id);
                        a.innerHTML = dados[i].nome_uf;
                        a.coords = dados[i].lat;
                        a.rel = dados[i].lon;

                        a.onclick = function () {
                            $("#usersList").hide();
                            $("#div_lista_item").hide();
                            $("#mapFinder").show();
                            $("#txt_id_cidade").val(this.title);
                            obj.value = this.innerHTML;
                            cidlat    = this.coords;
                            cidlon     = this.rel;
                            return false;
                        }
                        a.onmouseover = function(){this.style.backgroundColor='#9CC';};
                        a.onmouseout  = function(){this.style.backgroundColor='';};
                        document.getElementById("usersList").appendChild(a);
                    }
                });


            }

            function loadCityCob(obj) {
                if (obj.value.length < 1) {
                    $("#usersList").hide();
                    return false;
                }

                $.get("/api/cidade", {
                    nome: obj.value
                }).done(function(data) {

                    if(parseInt($("#txt_id_cidade_cob").val()) > 0)
                        return false;


                    var dados = JSON.parse(data);
                    if(dados == null){
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

                    $("#div_lista_item").css({'left':getPos(obj).left, 'top':getPos(obj).top + 25});


                    for(i = 0; i < dados.length; i++){
                        var a = document.createElement("a");
                        a.setAttribute("class", "ponteiro");
                        a.setAttribute("title", dados[i].id);
                        a.innerHTML = dados[i].nome_uf;
                        a.coords = dados[i].lat;
                        a.rel = dados[i].lon;

                        a.onclick = function () {
                            $("#usersList").hide();
                            $("#div_lista_item").hide();
                            $("#mapFinderCob").show();
                            $("#txt_id_cidade_cob").val(this.title);
                            obj.value = this.innerHTML;
                            cidlatCob = this.coords;
                            cidlonCob = this.rel;
                            return false;
                        }
                        a.onmouseover = function(){this.style.backgroundColor='#9CC';};
                        a.onmouseout  = function(){this.style.backgroundColor='';};
                        document.getElementById("usersList").appendChild(a);
                    }
                });


            }

            function validaDat(campo) {
            var date=campo.valor;
            var ardt=new Array;
            var ExpReg=new RegExp("(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[012])/[12][0-9]{3}");
            ardt=date.split("/");
            erro=false;
            if ( date.search(ExpReg)==-1){
                erro = true;
                }
            else if (((ardt[1]==4)||(ardt[1]==6)||(ardt[1]==9)||(ardt[1]==11))&&(ardt[0]>30))
                erro = true;
            else if ( ardt[1]==2) {
                if ((ardt[0]>28)&&((ardt[2]%4)!=0))
                erro = true;
                if ((ardt[0]>29)&&((ardt[2]%4)==0))
                erro = true;
            }
            if (erro) {
                swal('',valor + " não é uma data válida!!!",'error');
                campo.focus();
                campo.value = "";
                return false;
            }
            return true;
            }

            function salvar_step1(gettab){

            if(getOb('txt_nome').value == ''){
                $('#Tabs1').tabs({active:0});
                getOb('txt_nome').setAttribute("class", "txterr");
                getOb('txt_nome').focus();
                return false;
            }  else getOb('txt_nome').setAttribute("class", "txt");

            if(getOb('txt_cgc').value == ''){
                $('#Tabs1').tabs({active:0});
                getOb('txt_cgc').setAttribute("class", "txterr");
                getOb('txt_cgc').focus();
                return false;
            }  else getOb('txt_cgc').setAttribute("class", "txt");

            if(!valida_cpf_cnpj(getOb('txt_cgc').value)){
                $('#Tabs1').tabs({active:0});
                getOb('txt_cgc').setAttribute("class", "txterr");
                swal('','CPF/CNPJ INVÁLIDO','error');
                getOb('txt_cgc').focus();
                return false;
            }  else getOb('txt_cgc').setAttribute("class", "txt");


                var rgval = getOb('txt_rg').value;
                const valueForTest = (rgval ||  '').replace(/[\W_]+/g," ");
                if(valueForTest.length > 0 && valueForTest.length < 4) {
                    swal("","IE/RG precisa de pelo menos 4 dígitos ou não deve ser informado","error","error");
                    $('#Tabs1').tabs({active:0});
                    getOb('txt_rg').setAttribute("class", "txterr");
                    getOb('txt_rg').focus();
                    return false;
                }  else getOb('txt_rg').setAttribute("class", "txt0");


            if(getOb('txt_nascimento').value != ''){
                if(!valData(getOb('txt_nascimento'))){
                $('#Tabs1').tabs({active:0});
                getOb('txt_nascimento').setAttribute("class", "txterr");
                getOb('txt_nascimento').focus();
                return false;
                }  else getOb('txt_nascimento').setAttribute("class", "txt0");
            }else  getOb('txt_nascimento').setAttribute("class", "txt0");

            if(getOb('txt_data_cadastro').value != ''){
                if(!valData(getOb('txt_data_cadastro'))){
                $('#Tabs1').tabs({active:0});
                getOb('txt_data_cadastro').setAttribute("class", "txterr");
                getOb('txt_data_cadastro').focus();
                return false;
                }  else getOb('txt_data_cadastro').setAttribute("class", "txt0");
            }else  getOb('txt_data_cadastro').setAttribute("class", "txt0");


            if(gettab){
                $('#Tabs1').tabs({active:1});
                return false;
            }

            return true;
            }

            function salvar_step2(gettab){
            if(!salvar_step1(false))
                return false;

                if($('#txt_tipo_end').val() == 'ins' || $('#txt_tipo_end').val() == 'cobins'){
                    if(getOb('txt_nome_ponto').value == ''){
                        $('#Tabs1').tabs({active:1});
                        getOb('txt_nome_ponto').setAttribute("class", "txterr");
                        getOb('txt_nome_ponto').focus();
                        return false;
                    }  else getOb('txt_nome_ponto').setAttribute("class", "txt");

                    if(!/^(|\d{8})$/.test(getOb('txt_cep').value)){
                        $('#Tabs1').tabs({active:1});
                        getOb('txt_cep').focus();
                        getOb('txt_cep').setAttribute("class", "txterr");
                        return false;
                    } else getOb('txt_cep').removeAttribute("class");

                    if(getOb('txt_id_cidade').value == 0){
                        $('#Tabs1').tabs({active:1});
                        getOb('txt_cidade').setAttribute("class", "txterr");
                        getOb('txt_cidade').focus();
                        return false;
                    }  else getOb('txt_cidade').setAttribute("class", "txt");


                    if(getOb('txt_bairro').value.length < 4){
                        swal('Ops!','O campo BAIRRO precisa de pelo mínimo 4 caracteres','error');
                        $('#Tabs1').tabs({active:1});
                        getOb('txt_bairro').setAttribute("class", "txterr");
                        getOb('txt_bairro').focus();
                        return false;
                    }  else getOb('txt_bairro').setAttribute("class", "txt");

                    if(getOb('txt_endereco').value.length < 4){
                        swal('Ops!','O campo ENDEREÇO precisa de pelo mínimo 4 caracteres','error');
                        $('#Tabs1').tabs({active:1});
                        getOb('txt_endereco').setAttribute("class", "txterr");
                        getOb('txt_endereco').focus();
                    return false;
                    }  else getOb('txt_endereco').setAttribute("class", "txt");

                    if(getOb('txt_numero').value == ''){
                        $('#Tabs1').tabs({active:1});
                        getOb('txt_numero').setAttribute("class", "txterr");
                        getOb('txt_numero').focus();
                        return false;
                    }  else getOb('txt_numero').setAttribute("class", "txt");

                    if(getOb('txt_complemento').value.length < 4){
                        swal('Ops!','O campo COMPLEMENTO precisa de pelo mínimo 4 caracteres','error');
                        $('#Tabs1').tabs({active:1});
                        getOb('txt_complemento').setAttribute("class", "txterr");
                        getOb('txt_complemento').focus();
                        return false;
                    }  else getOb('txt_complemento').setAttribute("class", "txt");

                    if(getOb('txt_lat').value != '' || getOb('txt_lon').value != ''){

                        if(parseFloat(getOb('txt_lat').value) < -34 || parseFloat(getOb('txt_lat').value) > 6){
                            getOb('txt_lat').setAttribute("class", "txterr");
                            getOb('txt_lat').focus();
                            return false;
                        }  else getOb('txt_lat').setAttribute("class", "txt0");

                        if(parseFloat(getOb('txt_lon').value) < -75 || parseFloat(getOb('txt_lon').value) > -31){
                            getOb('txt_lon').setAttribute("class", "txterr");
                            getOb('txt_lon').focus();
                            return false;
                        }  else getOb('txt_lon').setAttribute("class", "txt0");

                    }  else {
                        getOb('txt_lat').setAttribute("class", "txt0");
                        getOb('txt_lon').setAttribute("class", "txt0");
                    }

            }

                if($('#txt_tipo_end').val() == 'cobins'){

                    if(!/^(|\d{8})$/.test(getOb('txt_cep_cob').value)){
                        $('#Tabs1').tabs({active:1});
                        getOb('txt_cep_cob').focus();
                        getOb('txt_cep_cob').setAttribute("class", "txterr");
                        return false;
                    } else getOb('txt_cep_cob').removeAttribute("class");

                    if(getOb('txt_id_cidade_cob').value == 0){
                        $('#Tabs1').tabs({active:1});
                        getOb('txt_cidade_cob').setAttribute("class", "txterr");
                        getOb('txt_cidade_cob').focus();
                        return false;
                    }  else getOb('txt_cidade_cob').setAttribute("class", "txt");

                    if(getOb('txt_bairro_cob').value.length < 4){
                        swal('Ops!','O campo BAIRRO DE COBRANÇA precisa de pelo mínimo 4 caracteres','error');
                        $('#Tabs1').tabs({active:1});
                        getOb('txt_bairro_cob').setAttribute("class", "txterr");
                        getOb('txt_bairro_cob').focus();
                        return false;
                    }  else getOb('txt_bairro_cob').setAttribute("class", "txt");

                    if(getOb('txt_endereco_cob').value.length < 4){
                        swal('Ops!','O campo ENDEREÇO DE COBRANÇA precisa de pelo mínimo 4 caracteres','error');
                        $('#Tabs1').tabs({active:1});
                        getOb('txt_endereco_cob').setAttribute("class", "txterr");
                        getOb('txt_endereco_cob').focus();
                        return false;
                    }  else getOb('txt_endereco_cob').setAttribute("class", "txt");

                    if(getOb('txt_numero_cob').value == ''){
                        $('#Tabs1').tabs({active:1});
                        getOb('txt_numero_cob').setAttribute("class", "txterr");
                        getOb('txt_numero_cob').focus();
                        return false;
                    }  else getOb('txt_numero_cob').setAttribute("class", "txt");

                    if(getOb('txt_complemento_cob').value.length < 4){
                        swal('Ops!','O campo COMPLEMENTO DE COBRANÇA precisa de pelo mínimo 4 caracteres','error');
                        $('#Tabs1').tabs({active:1});
                        getOb('txt_complemento_cob').setAttribute("class", "txterr");
                        getOb('txt_complemento_cob').focus();
                        return false;
                    }  else getOb('txt_complemento_cob').setAttribute("class", "txt");

                    if(getOb('txt_lat_cob').value != '' || getOb('txt_lon_cob').value != ''){

                        if(parseFloat(getOb('txt_lat_cob').value) < -34 || parseFloat(getOb('txt_lat_cob').value) > 6){
                            getOb('txt_lat_cob').setAttribute("class", "txterr");
                            getOb('txt_lat_cob').focus();
                            return false;
                        }  else getOb('txt_lat_cob').setAttribute("class", "txt0");

                        if(parseFloat(getOb('txt_lon_cob').value) < -75 || parseFloat(getOb('txt_lon_cob').value) > -31){
                            getOb('txt_lon_cob').setAttribute("class", "txterr");
                            getOb('txt_lon_cob').focus();
                            return false;
                        }  else getOb('txt_lon_cob').setAttribute("class", "txt0");

                    }  else {
                        getOb('txt_lat_cob').setAttribute("class", "txt0");
                        getOb('txt_lon_cob').setAttribute("class", "txt0");
                    }
                }

                if(gettab){
                    $('#Tabs1').tabs({active:2});
                    return false;
                }

                return true;
            }

            function salvar_step3(gettab){
                var totalFones = 0;
                if(!salvar_step2(false))
                    return false;

                for(i=1; i < getOb('tbl_contatos').rows.length-1; i++){
                    var campoContato = getOb('tbl_contatos').rows[i].cells[1].children[0];
                    var campoTContato = getOb('tbl_contatos').rows[i].cells[0].children[0];

                    if(!validaFone(campoTContato.value, campoContato.value)){
                        $('#Tabs1').tabs({active:2});
                        campoContato.focus();
                        campoContato.setAttribute("class", "txterr");
                        return false;
                    } else campoContato.setAttribute("class", "txt");

                    if(campoTContato.value == 't' && campoContato.value.length > 12)
                        totalFones++;

                    if(campoTContato.value == 'c' && campoContato.value.length > 13)
                        totalFones++;
                }

                if(totalFones == 0){
                    $('#Tabs1').tabs({active:2});
                    swal('','Cadastre pelo mínimo 1 telefone','error');
                    return false;
                }

                if(gettab){
                    $('#Tabs1').tabs({active:3});
                    return false;
                }

                return true;
            }

            function salvar_step4(gettab){
            if(!salvar_step3(false))
                return false;

                if(parseInt(getOb('txt_tenant').selectedIndex  || 0) < 1){
                getOb('txt_tenant').setAttribute("class", "txterr");
                getOb('txt_tenant').focus();
                $('#Tabs1').tabs({active:3});
                return false;
                }  else getOb('txt_tenant').setAttribute("class", "txt");


                if(parseInt(getOb('txt_carteira').selectedIndex  || 0) < 1){
                getOb('txt_carteira').setAttribute("class", "txterr");
                getOb('txt_carteira').focus();
                $('#Tabs1').tabs({active:3});
                return false;
                }  else getOb('txt_carteira').setAttribute("class", "txt");

                if(parseInt(getOb('txt_fidelidade').selectedIndex  || 0) < 1){
                getOb('txt_fidelidade').setAttribute("class", "txterr");
                getOb('txt_fidelidade').focus();
                $('#Tabs1').tabs({active:3});
                return false;
                }  else getOb('txt_fidelidade').setAttribute("class", "txt");

                var onlynumber = /^\d*$/;
                if(!onlynumber.test(getOb('txt_bonus').value)){
                    getOb('txt_bonus').setAttribute("class", "txterr");
                    getOb('txt_bonus').focus();
                    swal('','O bônus deve ser um número inteiro positivo','error');
                    $('#Tabs1').tabs({active:3});
                    return false;
                }  else getOb('txt_bonus').setAttribute("class", "txt0");


                if(parseInt(getOb('txt_eqp').selectedIndex  || 0) < 1){
                    getOb('txt_eqp').setAttribute("class", "txterr");
                    getOb('txt_eqp').focus();
                    $('#Tabs1').tabs({active:3});
                    return false;
                }  else getOb('txt_eqp').setAttribute("class", "txt");

                // Plano de internet
                var totalRowSaved = 0;
                $("select[name*='txt_produto_tipo[]']").each(function(){if($(this).val() == 'net') totalRowSaved++;});
                if(totalRowSaved == 0){
                    swal('','Cadastre um plano de internet','error');
                    $('#Tabs1').tabs({active:3});
                    return false;
                }


                // Nao salvo
                var stopScript = false;
                $("select[name*='txt_produto_tipo[]']").each(function(){
                if($(this).is(":enabled")){
                    stopScript = true;
                    $('#Tabs1').tabs({active:3});
                    swal('','Existe plano sem salvar, verfique!','error');
                    return false;
                }
                }); if(stopScript) return;


                if(parseInt(getOb('txt_tipo_fat').selectedIndex  || 0) < 1){
                    getOb('txt_tipo_fat').setAttribute("class", "txterr");
                    getOb('txt_tipo_fat').focus();
                    $('#Tabs1').tabs({active:3});
                    return false;
                }  else getOb('txt_tipo_fat').setAttribute("class", "txt");

        
                if(parseInt(getOb('txt_faturamento').selectedIndex  || 0) < 1){
                    getOb('txt_faturamento').setAttribute("class", "txterr");
                    getOb('txt_faturamento').focus();
                    $('#Tabs1').tabs({active:3});
                    return false;
                    }  else getOb('txt_faturamento').setAttribute("class", "txt");


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
                
                if((Number($("#txt_total_adesao").val().replace(',','.'))) < 0){
                    swal('','O VALOR DA ADESÃO NÃO PODE SER NEGATIVO','error');
                    $('#Tabs1').tabs({active:3});
                    return false;
                }

                if((Number($("#txt_total_rescisao").val().replace(',','.'))) < 0){
                    swal('','O VALOR DA RESCISÃO NÃO PODE SER NEGATIVO','error');
                    $('#Tabs1').tabs({active:3});
                    return false;
                }

                if((Number($("#txt_total_recorrente").val().replace(',','.'))) < 0){
                    swal('','O VALOR RECORRENTE NÃO PODE SER NEGATIVO','error');
                    $('#Tabs1').tabs({active:3});
                    return false;
                }

                if(gettab){
                    $('#Tabs1').tabs({active:4});
                    return false;
                }

                return true;

            }

            function salvar_step5(gettab){


                if(!salvar_step4(false)){
                return false;
                }

                const regexMacAddress = /^([0-9A-Fa-f]{2}[:]){5}([0-9A-Fa-f]{2})$/;
                const regexPppCredential = /^[0-9a-zA-Z_\-@.:\/]+$/;
                const tipoConexao = $('input[type=radio][name=tipo_conexao]:checked').val();
                const tipoAlocacao = $('input[type=radio][name=tipo_alocacao]:checked').val();
                const pool = $('#txt_pool:visible').val();
                const ipv4 = $("#hid_ipv4").val();
                const cidr = $('#txt_cidr:visible').val();
                const usuario = $("#txt_usuario:visible").val();
                const senha = $("#txt_senha:visible").val();
                const tecnologia = $('#txt_tecnologia:visible').val();
                const fttb = $('#txt_fttb:visible').val();
                const cto = $('#txt_caixa:visible').val();
                const spliter = $('#txt_posicao:visible').val();

                //Valida conexao
                if(!tipoConexao){
                    return customAlert('Escolha o tipo da conexão');
                }

                // Valida conexao autenticada
                if(['pppoe', 'ipoe', 'hotspot', 'dhcp'].includes(tipoConexao)){

                    //Valida alocacao
                    if(!tipoAlocacao){
                        return customAlert('Escolha o tipo da alocação');
                    }

                    if(tipoAlocacao == 'auto' && !pool){
                        return customAlert('Informe a pool que o ISPFY deverá buscar o IP');
                    }

                    if(tipoAlocacao == 'manual'){
                        if(!pool){
                            return customAlert('Informe a pool de origem do bloco de ip');
                        }

                        if(!cidr){
                            return customAlert('Informe o CIDR do IP que deve ser /32');
                        }

                        if(!ipv4){
                            return customAlert('Escolha o ip desejado na lista');
                        }
                    }
                    
                    
                    //Valida usuario
                    if(['pppoe', 'ipoe', 'hotspot'].includes(tipoConexao)){
                        if(!regexPppCredential.test(usuario)){
                            return customAlert('Informe o usuário de acordo com os caractéres permitidos');
                        }
                        if( !regexPppCredential.test(senha)){
                            return customAlert('Informe a senha de acordo com os caractéres permitidos');
                        }
                    }
                    
                    if(tipoConexao == 'dhcp'){
                        if(!regexMacAddress.test(usuario)){
                            return customAlert('Informe o MAC corretamente do equipamento que irá autenticar');
                        }
                    }
                }
                
                // Valida ip binding
                if(tipoConexao == 'binding'){
                    if(!pool){
                        return customAlert('Informe a pool de origem do bloco de ip');
                    }

                    if(!cidr){
                        return customAlert('Informe o CIDR da network desejada');
                    }

                    if(!ipv4){
                        return customAlert('Escolha a network desejada na lista');
                    }

                }

                //Valida tecnologia
                if(!tecnologia){
                    return customAlert('Escolha a tecnologia');
                }
                
                if(tecnologia == 'fttb' && !fttb){
                    return customAlert('Escolha a FTTB');
                }
            
            $('#hid_validator').val(''+Math.random());

            var jsondata = null;
            swal({
                title: 'Gerar este cadastro?',
                type: 'warning',
                html: '<span style="color: red;">Este módulo irá cadastrar o cliente, gerar o seu contrato, seu ponto de acesso e registrará o atendimento como fechado, dispensando assim o ciclo normal de instalação. Tem certeza disso?</span>',
                showCancelButton: true,
                confirmButtonColor: 'red',
                confirmButtonText: "Sim, gerar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                showLoaderOnConfirm: true,
                allowEscapeKey: false,
                allowOutsideClick: false,
                preConfirm:  function(){
                return new Promise(function (resolve, reject) {
                    $.post("easycad.php", $('#frmPostar').serialize()).done(function( response ) {
                    try{
                        jsondata = JSON.parse(response);
                        if($.isPlainObject(jsondata))
                            resolve();
                        else reject(response);
                    } catch(e){
                        reject(response);
                    }
                    });
                });

                }
            }).then(function(){
                $('#tbl_ok_nome').html(jsondata.nome);
                $('#tbl_ok_det').html(jsondata.detalhes);
                $('#tbl_ok_link').attr('href','../sis_cobrancas/detalhes.php?cliente='+jsondata.idcliente);
                $('#tbl_cad').hide(100);
                $('#tbl_ok').show(100);
            });


            }

            function loadProdutos(boxtipo){
            var tipo = boxtipo.value;
            var table =  getOb('tbl_produtos');
            var row = boxtipo.parentNode.parentNode.rowIndex;
            var obj = getOb('tbl_produtos').rows[row].cells[1].children[0];

            getOb('tbl_produtos').rows[row].cells[2].children[0].value = '';
            getOb('tbl_produtos').rows[row].cells[3].children[0].value = '';
            getOb('tbl_produtos').rows[row].cells[4].children[0].value = '';
            getOb('tbl_produtos').rows[row].cells[5].children[0].value = '';
            $(getOb('tbl_produtos').rows[row].cells[6].children[0]).hide();


            if(!$("#txt_tenant").val() > 0){
                swal('','Escolha a empresa resposável primeiro','error');
                boxtipo.value = '';
                return;
            }


            $.get("easycad.php", {
                getProdutoByTipo: tipo,
                getProdutoProfile: $("#txt_profile").val(),
                getIdTenant: $("#txt_tenant").val()
            }).done(function( data ) {
                var dados = JSON.parse(data);
                var option = document.createElement("OPTION");
                obj.innerHTML = "";
                obj.appendChild(option);
                for(i=0; i < dados.length; i++){
                var option = document.createElement("OPTION");
                option.innerHTML = dados[i][1];
                    option.value = dados[i][0];
                obj.appendChild(option);
                }
                $(obj).attr('disabled',false);
            });
            }

            function loadProdutoDet(boxprod){
            var prod = boxprod.value;
            var table =  getOb('tbl_produtos');
            var row = boxprod.parentNode.parentNode.rowIndex;
            var txt_adesao = getOb('tbl_produtos').rows[row].cells[2].children[0];
            var txt_rescisao = getOb('tbl_produtos').rows[row].cells[3].children[0];
            var txt_valor = getOb('tbl_produtos').rows[row].cells[4].children[0];
            var txt_recor = getOb('tbl_produtos').rows[row].cells[5].children[0];
            var btn_salva = getOb('tbl_produtos').rows[row].cells[6].children[0];

            $(btn_salva).hide();

            $.get("easycad.php", {getProdutoById: prod }).done(function( data ) {
                var dados = JSON.parse(data);
                txt_valor.value = dados[0];
                txt_adesao.value = dados[1];
                txt_rescisao.value = dados[2];
                txt_recor.value = dados[3];

                if(parseInt(prod) > 0)
                $(btn_salva).show();
            });

            }

            function addItemProduto(){
            var table = document.getElementById("tbl_produtos");
            var rowcount = table.rows.length;
            var row = table.insertRow(rowcount -2);


            row.innerHTML = '<tr><td height="24"><select name="txt_produto_tipo[]" class="prodnew"  style="height:20px; padding-left:2px; border-radius:5px; text-transform:uppercase; cursor:pointer;" onChange="loadProdutos(this);" ><option></option><option value="net">INTERNET</option><option value="sva">SERVIÇO</option><option value="sla">SLA</option></select></td><td><select disabled="disabled" name="txt_produto_item[]" class="prodnew" style="height:20px; padding-left:2px; border-radius:5px;   width:250px; text-transform:uppercase; cursor:pointer;" onChange="loadProdutoDet(this)" ><option></option></select><input type="hidden" name="txt_id_produto[]"></td><td><input type="text" class="txt1"   autocomplete="off" style="height:20px; width:60px; padding-left:2px; border-radius:5px;  border:solid; border-width:1px; border-color:#CCC; background-color:#F2F2F2; text-transform:uppercase; text-align:center;" readonly /></td><td><input  type="text" class="txt1" autocomplete="off" style="height:20px; width:60px; padding-left:2px; border-radius:5px;  border:solid; border-width:1px; border-color:#CCC; background-color:#F2F2F2; text-transform:uppercase; text-align:center;"  readonly/></td><td><input type="text" class="txt1"autocomplete="off" style="height:20px; width:60px; padding-left:2px; border-radius:5px;  border:solid; border-width:1px; border-color:#CCC; background-color:#F2F2F2; text-transform:uppercase; text-align:center;" readonly /></td><td align="center" valign="middle"><img src="../iconmenu/sair.png" width="17" height="17"  style="cursor:pointer; display:block;" onclick="remProdutoItem(this)"/></td><td align="center" valign="middle"><img src="../iconmenu/checado.png" width="17" height="17"  style="cursor:pointer; display:none;" onclick="salvaProdutoItem(this)"/></td></tr>';



            }

            function remProdutoItem(obj){
            var table =  document.getElementById("tbl_produtos");
            var row = obj.parentNode.parentNode.rowIndex;

            var table =  document.getElementById("tbl_produtos");
            var row = obj.parentNode.parentNode.rowIndex;
            table.deleteRow(row);


            if(table.rows.length < 4){
                $("#txt_desconto_adesao").val(0);
                $("#txt_desconto_rescisao").val(0);
                $("#txt_desconto_recorrente").val(0);
            }

            calculaTotal();
            }

            function salvaProdutoItem(obj){
            var table =  document.getElementById("tbl_produtos");
            var row = obj.parentNode.parentNode.rowIndex;
            var stopScript = false;

            var boxTipoValor = table.rows[row].cells[0].children[0].value;
            var boxIdProdValor = table.rows[row].cells[1].children[0].value;
            table.rows[row].cells[1].children[1].value = boxIdProdValor;

                $("select[name*='txt_produto_tipo[]']").each(function(){
                    if($(this).is(":disabled") == true)
                        if($(this).val() == boxTipoValor && boxTipoValor == 'net'){
                            stopScript = true;
                            swal('','Você não pode adicionar mais de um plano de internet!','error');
                        }
                }); 
                if(stopScript) return;

                $("select[name*='txt_produto_item[]']").each(function(){
                    if($(this).is(":disabled")==true)
                        if($(this).val() == boxIdProdValor && boxTipoValor === 'sla'){
                            stopScript = true;
                            swal('','Você não pode adicionar o mesmo SLA duas vezes','error');
                        }
                }); 
                if(stopScript) return;


            //valida
            if((table.rows[row].cells[0].children[0].selectedIndex || 0) == 0){
                table.rows[row].cells[0].children[0].className = 'txterr';
                return;
            } else table.rows[row].cells[0].children[0].className = 'prodnew';

            if((table.rows[row].cells[1].children[0].selectedIndex || 0) == 0){
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

            table.rows[row].cells[2].children[0].setAttribute("name","txt_produto_adesao[]");
            table.rows[row].cells[3].children[0].setAttribute("name","txt_produto_rescisao[]");
            table.rows[row].cells[4].children[0].setAttribute("name","txt_produto_recorrente[]");

            //soma
            calculaTotal();


            }

            function calculaTotal(){
            var divAdesao = 0.00;
            var totalAdesao = 0.00;
            var totalRescisao = 0.00;
            var totalRecorrente = 0.00;
            var totalAdesaoComDesconto = 0.00;
            var totalRescisaoComDesconto = 0.00;
            var totalRecorrenteComDesconto = 0.00;

            $("input[name*='txt_produto_adesao[]']").each(function(){
                totalAdesao+=(Number($(this).val().replace(',','.')));
                });
            $("input[name*='txt_produto_rescisao[]']").each(function(){
                totalRescisao+=(Number($(this).val().replace(',','.')));
                });
            $("input[name*='txt_produto_recorrente[]']").each(function(){
                totalRecorrente+=(Number($(this).val().replace(',','.')));
                });

            if($("#txt_fidelidade").val() == 0 || $("#txt_fidelidade").val() == '')
                totalRescisao = 0.0;


            totalAdesaoComDesconto =  totalAdesao + (Number($("#txt_desconto_adesao").val().replace(',','.'))) ;
            totalRescisaoComDesconto =  totalRescisao + (Number($("#txt_desconto_rescisao").val().replace(',','.')));
            totalRecorrenteComDesconto = totalRecorrente + (Number($("#txt_desconto_recorrente").val().replace(',','.')));
            divAdesao = totalAdesaoComDesconto / Number($('#txt_parcelas').val()).toFixed(2);

                $("#lbl_parcela_adesao").val($('#txt_parcelas').val());
            $("#lbl_total_adesao").val(divAdesao.toFixed(2).replace('.',','));
            $("#lbl_total_rescisao").val(totalRescisaoComDesconto.toFixed(2).replace('.',','));
            $("#lbl_total_recorrente").val(totalRecorrenteComDesconto.toFixed(2).replace('.',','));

            $("#txt_total_adesao").val(totalAdesao.toFixed(2).replace('.',','));
            $("#txt_total_rescisao").val(totalRescisao.toFixed(2).replace('.',','));
            $("#txt_total_recorrente").val(totalRecorrente.toFixed(2).replace('.',','));


            }

            function setProfile(obj){

            if((obj.selectedIndex || 0) > 0){
                $('#tbl_produtos').show();
                $('#tbl_set_perfil').hide();
            } else {
                $('#tbl_set_perfil').show();
                $('#tbl_produtos').hide();
            }

            resetPlanos();

            }

            function resetPlanos(){
                var table = document.getElementById("tbl_produtos");
                var rowcount = table.rows.length;
                for(var i=1; i < rowcount -2; i++)
                    table.deleteRow(1);
            }

            function cgcSplitNonNumber(obj){
            obj.value = obj.value.replace(/\D+/g,'');
            }

            function validateIP(valor) {
                    var RegExPattern = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;

                    if( (!(valor.match(RegExPattern)) && (valor.value!=""))  || valor=='255.255.255.255' ) {
                    return false;
                    }
                return true;
            }

            function loadCep(object){
                if(object.value.length == 8 && !object.loading){
                    $("#txt_cidade,#txt_bairro,#txt_endereco,#txt_numero,#txt_complemento").attr('disabled', true);
                    $("#txt_cidade").val('Consultando cep online...');
                    $("#txt_cep").blur();
                    object.loading = true;
                    $.get(`/api/cidade/cep/${object.value}`).done(function(data) {
                        const obj = JSON.parse(data);
                            $("#mapFinder").show();
                            $("#txt_id_cidade").val(obj.id_addr_city);
                            $("#txt_cidade").val(`${obj.addr_city}, ${obj.addr_uf}`);
                            $("#txt_bairro").val(obj.addr_district);
                            $("#txt_endereco").val(obj.addr_street);
                            $("#txt_numero").val(obj.addr_street_number);
                            $("#txt_complemento").val(obj.addr_complement);
                    }).fail((err) => {
                        $("#mapFinder").hide();
                        $("#txt_id_cidade").val(0);
                        $("#txt_cidade").val('');
                        $("#txt_bairro").val('');
                        $("#txt_endereco").val('');
                        $("#txt_numero").val('');
                        $("#txt_complemento").val('');
                        swal('', err.responseText, 'error');
                    }).always(() => {
                        $("#txt_cidade,#txt_bairro,#txt_endereco,#txt_numero,#txt_complemento").attr('disabled', false);
                        object.loading = false;
                    })
                }
            }

            function loadCepCob(object){
                if(object.value.length == 8 && !object.loading){
                    $("#txt_cidade_cob,#txt_bairro_cob,#txt_endereco_cob,#txt_numero_cob,#txt_complemento_cob").attr('disabled', true);
                    $("#txt_cidade_cob").val('Consultando cep online...');
                    $("#txt_cep_cob").blur();
                    object.loading = true;
                    $.get(`/api/cidade/cep/${object.value}?all=1`).done(function(data) {
                        const obj = JSON.parse(data);
                            $("#mapFinderCob").show();
                            $("#txt_id_cidade_cob").val(obj.id_addr_city);
                            $("#txt_cidade_cob").val(`${obj.addr_city}, ${obj.addr_uf}`);
                            $("#txt_bairro_cob").val(obj.addr_district);
                            $("#txt_endereco_cob").val(obj.addr_street);
                            $("#txt_numero_cob").val(obj.addr_street_number);
                            $("#txt_complemento_cob").val(obj.addr_complement);
                    }).fail((err) => {
                        $("#mapFinderCob").hide();
                        $("#txt_id_cidade_cob").val(0);
                        $("#txt_cidade_cob").val('');
                        $("#txt_bairro_cob").val('');
                        $("#txt_endereco_cob").val('');
                        $("#txt_numero_cob").val('');
                        $("#txt_complemento_cob").val('');
                        swal('', err.responseText, 'error');
                    }).always(() => {
                        $("#txt_cidade_cob,#txt_bairro_cob,#txt_endereco_cob,#txt_numero_cob,#txt_complemento_cob").attr('disabled', false);
                        object.loading = false;
                    })
                }
            }

            function loadTenantWallets(idTenant){
                const _idTenant = idTenant || 0;
                resetPlanos();
                resetConexao(true);

                $('#txt_carteira').html(new Option());
                $('#txt_carteira').attr('disabled', true);

                if(!idTenant) return;
                
                $.get(`/api/system/params/tenant/${_idTenant}/wallet/active`).done((data) => {
                    const rows = JSON.parse(data) || [];
                    rows.forEach(row => $('#txt_carteira').append(new Option(row.title, row.id)));
                    if(rows.length) $('#txt_carteira').attr('disabled', false);
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

            function resetConexao(resetTipoConexao = false) {

                if(resetTipoConexao){
                    $('input[type=radio][name=tipo_conexao]').attr('checked', false);
                }

                $("#div_tipo_alocacao").hide();
                $("#div_pool_ipv4").hide();
                $("#div_bloco_ipv4").hide();
                $("#div_credenciais").hide();
                $("#div_tipo_tecnologia").hide();
                $("#div_tipo_fttb").hide();
                $("#div_tipo_ftth").hide();
                $('#txt_tecnologia').val('');
                $("#txt_usuario").val('');
                $("#txt_senha").val('');
                $("#txt_cidr").val('');
                $("#txt_ipv4").val('');
                $("#hid_ipv4").val('');
                $('#txt_pool').val('');
                $('#txt_cidr').val('');
                $('input[type=radio][name=tipo_alocacao]').attr('checked', false);
            }
            
            function triggerConexao() {

                function loadFttb() {
                    $.get(`/api/fttb/allowed`).done(function(data) {
                        document.getElementById('txt_fttb').innerHTML = "";
                        document.getElementById('txt_fttb').appendChild(document.createElement("OPTION"));
                        const fttbs = JSON.parse(data) || [];
                        fttbs.forEach(row => {
                            const option = new Option(row.title, row.iface_key);
                            $('#txt_fttb').append(option);
                        });
                    });

                }

                function loadCaixas() {
                    $.get("/api/geofiber/cto").done(function(data) {
                        document.getElementById('txt_caixa').innerHTML = "";
                        document.getElementById('txt_posicao').innerHTML = "";
                        document.getElementById('txt_caixa').appendChild(document.createElement("OPTION"));
                        const ctos = JSON.parse(data) || [];
                        ctos.forEach(row => $('#txt_caixa').append(new Option(`${row.project_title} - ${row.title}`, row.id)));
                    });
                }

                function loadCaixaPosicao(idCaixa) {
                    $.get(`/api/geofiber/cto/${idCaixa}/spliter-via`).done(function(data) {
                        document.getElementById('txt_posicao').innerHTML = "";
                        document.getElementById('txt_posicao').appendChild(document.createElement("OPTION"));
                        const ctos = JSON.parse(data) || [];
                        ctos.forEach(row => $('#txt_posicao').append(new Option(`${row.spliter_title} - VIA ${row.spliter_via}`, row.id)));
                    });
                }

                const loadIpv4Cidr = (reset = false) => {

                    if(reset){
                        $("#iplist").hide();
                        $("#div_iplist").hide();
                        $("#iplist").html("");
                        return;
                    }

                    const pool = $('#txt_pool').val();
                    const cidr = $('#txt_cidr').val();
                    const obj = $('#txt_ipv4')[0];
                    
                    if(!pool || !cidr){
                        return false;
                    }
                    
                    $.get('/api/network/ippool/ipv4/range-by-cidr', {
                            pool_name: pool,
                            cidr: cidr,
                            target_ipv4: obj.value,
                            id_point: null
                    }).done(function(data) {
                        
                        const dados = JSON.parse(data) || [];

                        if (dados.length > 0) {
                            $("#div_iplist").show();
                            $("#iplist").show();
                            $("#iplist").html("");
                        } else {
                            $("#iplist").hide();
                            $("#div_iplist").hide();
                            $("#iplist").html("");
                        }

                        $("#div_iplist").css({'left': getPos(obj).left, 'top': getPos(obj).top + 32});
                        for (i = 0; i < dados.length; i++) {
                            var a = document.createElement("a");
                            a.setAttribute("title", dados[i].network);

                            if(dados[i].addr_start == dados[i].addr_end){
                                a.innerHTML = dados[i].addr_start;
                            } else {
                                a.innerHTML = `${dados[i].addr_start} - ${dados[i].addr_end}`;
                            }
                            
                            a.onclick = function () {
                                obj.value = this.innerHTML;
                                $('#hid_ipv4').val(this.title);
                                $("#div_iplist").hide();
                                $('#txt_ipv4').attr('readonly', true);
                                $('#txt_ipv4').css('background-color', '#ddd');
                                return false;
                            }
                            a.onmouseover = function () {
                                this.style.backgroundColor='#9CC';
                            };
                            a.onmouseout = function () {
                                this.style.backgroundColor='';
                            };
                            document.getElementById("iplist").appendChild(a);
                        }
                    });
                }
                
                //ON CHANGE TIPO CONEXAO
                $('input[type=radio][name=tipo_conexao]').on('change', function() {

                    const selected = $(this).val();
                    
                    resetConexao();
                    loadIpv4Cidr(true);

                    if(['pppoe', 'ipoe', 'hotspot', 'dhcp'].includes(selected)){
                        $('#txt_cidr').find('option[value!="32"]').attr('disabled', true)
                        $('#txt_cidr').val('32');
                        $("#div_tipo_alocacao").show();
                        $("#div_credenciais").show();
                        
                        if(selected == 'dhcp'){
                            $("#div_credenciais_senha").hide();
                        } else {
                            $("#div_credenciais_senha").show();
                        }
                    }

                    if(selected == 'binding'){
                        $("#div_pool_ipv4").show();
                        $("#div_bloco_ipv4").show();
                        $('#txt_cidr').find('option').attr('disabled', false);
                        $('#txt_cidr').val('');
                    }

                    $("#div_tipo_tecnologia").show();
                });

                //ON CHANGE TIPO ALOCACAO
                $('input[type=radio][name=tipo_alocacao]').on('change', function() {
                    const selected = $(this).val();
                    $("#div_pool_ipv4").hide();
                    $("#div_bloco_ipv4").hide();
                    $("#txt_ipv4").val('');
                    $("#hid_ipv4").val('');
                    $("#txt_pool").val('');
                    loadIpv4Cidr(true);
                    
                    if(selected == 'auto'){
                        $("#div_pool_ipv4").show();
                    }

                    if(selected == 'manual'){
                        $("#div_pool_ipv4").show();
                        $("#div_bloco_ipv4").show();
                    }
                });

                //ON CHANGE TECNOLOGIA
                $('#txt_tecnologia').on('change', function() {
                    const selected = $(this).val();

                    $("#div_tipo_fttb").hide();
                    $("#div_tipo_ftth").hide();
                    $("#txt_fttb").val('');
                    $("#txt_caixa").val('');
                    $("#txt_posicao").val('');
                    $("#txt_serial").val('');
                    
                    if(selected == 'fttb'){
                        loadFttb();
                        $("#div_tipo_fttb").show();
                    }

                    if(selected == 'ftth'){
                        loadCaixas();
                        $("#div_tipo_ftth").show();
                    }
                });

                //ON CHANGE CTO
                $('#txt_caixa').on('change', function() {
                    loadCaixaPosicao($(this).val());
                });

                //ON ADDRESS KEYUP
                $('#txt_ipv4').on('keyup', function() {
                    loadIpv4Cidr();
                });

                //ON ADDRESS FOCUS
                $('#txt_ipv4').on('focus', function() {
                    $(this).val('');
                    $('#hid_ipv4').val('');
                    $(this).attr('readonly', false);
                    $(this).css('background-color', '#9CC');
                    loadIpv4Cidr();
                });
                
                //ON CIDR or POOL CHANGE
                $('#txt_cidr,#txt_pool').on('change', function() {
                    loadIpv4Cidr(true);
                });
                
            }

            $(function() {

                // Carrega carteiras
                loadTenantWallets();
                
                // Inicia modulo de conexa e suas dependencias
                triggerConexao();

                $("input[alt*='money']").maskMoney({
                    thousands: '',
                    decimal: ',',
                    symbolStay: true,
                    allowNegative: true
                });

                $("#Tabs1").tabs({
                    active: 0
                });

                $("#txt_data_cadastro").datepicker({
                    dateFormat: 'dd/mm/yy'
                });

                $("#txt_nascimento").datepicker({
                    dateFormat: 'dd/mm/yy'
                });

                if($('#txt_tipo_fat option').length == 2){
                    $('#txt_tipo_fat :nth-child(2)').prop('selected', true);
                }

                $('#ck_rgie_isento').on('change', (e) => {
                    $('#txt_rg').attr('readonly', e.target.checked);
                    $('#txt_rg').val(e.target.checked ? 'ISENTO' : '');
                });

                $('#txt_tenant').on('change', function() {
                    loadTenantNfeCom($(this).val());
                }).trigger('change');

            });
        