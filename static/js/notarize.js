// Config
const contractAddress = "0x1400a818c23c00517fb006c7d233543340478998";
const byteCode = "60806040527396e0089c04c99e69e4445787ba4cc3cea6e1b82f6000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555073cf4e87991826081d172b61b2e1b2800f18da8ce7600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506103ef806100bc6000396000f300608060405260043610610062576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff1680631afa8e3b146100645780638e0b10f7146100bb578063a58811d614610112578063e71a93101461017b575b005b34801561007057600080fd5b506100796101e9565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b3480156100c757600080fd5b506100d061020f565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b34801561011e57600080fd5b50610179600480360381019080803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284378201915050505050509192919290505050610234565b005b6101cf600480360381019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610309565b604051808215151515815260200191505060405180910390f35b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60016002826040518082805190602001908083835b60208310151561026e5780518252602082019150602081019050602083039250610249565b6001836020036101000a038019825116818451168082178552505050505050905001915050908152602001604051809103902060006101000a81548160ff0219169083151502179055506103056000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff16600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16610309565b5050565b6000803490508373ffffffffffffffffffffffffffffffffffffffff166108fc6009600a8481151561033757fe5b04029081150290604051600060405180830381858888f19350505050158015610364573d6000803e3d6000fd5b508273ffffffffffffffffffffffffffffffffffffffff166108fc600a8381151561038b57fe5b049081150290604051600060405180830381858888f193505050501580156103b7573d6000803e3d6000fd5b506001915050929150505600a165627a7a72305820d7201f213a36b0e18c9d02f0b7bd377981624d6f897da101afa9f71f1a7f86470029";
const gas = "99000";
const etherValue = web3.toWei(1, 'ether');

// Global variables
var myAddress;
var isMetaMaskInstalled;
var isUserLoggedIn;
var fileHash;
var eth;
var isNotarized;
var timeout;
var fileName;
var fileType;
var fileSize;
var lastModified;
var csrf_token;


Dropzone.autoDiscover = false;

$(document).ready(function () {
    csrf_token = $("[name=csrfmiddlewaretoken]").val();
    if (typeof web3 !== 'undefined') {

        isMetaMaskInstalled = true;

        if (web3.eth.accounts.length !== 0) {
            isUserLoggedIn = true;
        }
    }

    $('#dropzoneform').dropzone({
        maxFiles: 1,
        uploadMultiple: false,
        init: function () {
            this.on("addedfile", function (file) {
                fileName=file.name;
                fileType=file.type;
                fileSize=file.size;
                lastModified=file.lastModified;
                $("#dropzoneform").hide().next().hide();
                $("#dropzone-results").show();
                $("[data-file-name]").html(file.name);
                if (file.type) {
                    $("[data-file-type]").html(file.type);
                }
                else {
                    $("[data-file-type]").html("Unknown");
                }
                $("[data-file-size]").html(file.size);
                $("[data-file-last-modified]").html(file.lastModifiedDate);
                setSpinner(true, "Hashing file…");
                getHash(file);

                // Format file size
                formatFileSize();
            });
        }
    });

    $("#upload-button-notarize").click(function () {
        createTransaction();
    });

    $("#upload-button-cancel").click(function () {
        $("#upload-buttons").hide();
        $("[data-file-name]").html("Unknown");
        $("[data-file-type]").html("Unknown");
        $("[data-file-size]").html("Unknown");
        $("[data-file-last-modified]").html("Unknown");
        $("#hash-result").text("");
        $("#dropzoneform").show();
        Dropzone.forElement("#dropzoneform").removeAllFiles(true);
        $("#dropzone-results").hide();
        $(".additional-info").show();
        setSpinner(false);
        clearTimeout(timeout);
    });
});

function formatFileSize() {
    $("[data-file-size]").formatNumber();
    $("[data-file-size]").html($("[data-file-size]").html() + " bytes");
}

function getHash(file) {
    var reader = new FileReader();
    reader.addEventListener("loadend", function (event) { fileHash = "0x" + sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(event.target.result)); $("#hash-result").html(fileHash); getHashOnDone(); });
    reader.readAsBinaryString(file);
}

function getHashOnDone() {
    setSpinner(false);
    $("#upload-buttons").show();
}

async function waitForTxToBeMined(txHash, notaryContract) {
    ongoingSubmissionAjax(fileName, fileType, fileSize, lastModified, fileHash, transactionHash=txHash);
    setSpinner(true, "Waiting for the transaction to be mined…");
    getTransactionHistoryAjax();
    var txReceipt;

    // Waiting for receipt
    while (!txReceipt) {
        try {
            txReceipt = await eth.getTransactionReceipt(txHash)

            // Receipt returned => Verify if document is signed properly
            if (txReceipt) {
                notaryContract.hasProof(fileHash).then((function (result) {
                    isNotarized = result;
                    if (isNotarized) {
                        setProofAjax(txHash);
                        setSpinner(false);
                        showAlert('Your document was notarized. You can check it on <a href="https://ropsten.etherscan.io/tx/"'+txHash+' target="_blank" aria-label="Your notarized document link">https://ropsten.etherscan.io/tx/'+txHash+'</a>', 'Notarization done');
                        getTransactionHistoryAjax();
                    }
                    else {
                        showAlert("We could not notarise your document.", "We are sorry");
                    }
                }));
            }
            else {
                console.log("Waiting for the blockchain transaction to be mined…");
            }
        } catch (err) {
            showAlert("An error occured. See the console for further info…", "An error occured");
            console.log(err);
        }
    }
}

function errorHandler(_error) {

    var error = _error.toString();

    // User rejected transaction
    if (error.indexOf("User denied transaction signature") >= 0) {
        setSpinner(false);
    }
}

function setSpinner(visible, text = null, add=false) {
    switch(add){
        case true:
            $("#spinner-text").text($("#spinner-text").text()+text);
            break;
        default:
            $("#spinner-text").text(text);
            break;
    }

    switch (visible) {
        case false:
            $(".spinner").hide();
            break;
        default:
            $(".spinner").show();
            break;
    }
}

function createTransaction() {
    if (isMetaMaskInstalled) {
        eth = new Eth(web3.currentProvider);
        if (isUserLoggedIn) {
            isNotarized = false;
            setSpinner(true, "Waiting for confirmation of the transaction…");
            timeout=setTimeout(function () {
                setSpinner(true, " (Takes too long? Try to increase the gas limit or gas price…)", true);
            }, 90000);
            myAddress = web3.eth.accounts[0];
            var contract = new EthContract(eth);
            var notaryContract = contract(abi, byteCode, { from: myAddress, gas: gas, value: web3.toWei(1,'ether') }).at(contractAddress);
            notaryContract.notarise(fileHash).then(function (notarise) {
                waitForTxToBeMined(notarise, notaryContract);
            }).catch(function (error) { errorHandler(error) });

        }
        else {
            showAlert("You are not logged to your MetaMask account.<br/><br/>You need to log in to MetaMask and refresh this page.", "Not Logged In");
        }
    }
    else {
        showAlert("This is a blockchain application, you need to install Metamask from <a href='https://metamask.io/' target='_blank'>MetaMask.io</a> if you want to play around with blockchains.", "MetaMask not detected");
    }
}

function ongoingSubmissionAjax(file_name, file_mime_type, file_size, file_last_modified, file_hash, transaction_hash){
    $.ajax({
        type: "POST",
        url: '/ajax/ongoing_submissions/',
        dataType: "json",
        headers: {
            'X-CSRFToken': csrf_token
        },
        cache: false,
        data: {
            file_name: file_name,
            file_mime_type: file_mime_type,
            file_size: file_size,
            file_last_modified: file_last_modified,
            file_hash,
            has_proof: "False",
            transaction_hash: transaction_hash
        },
        success: function(response){

            switch(response.result){
                case "true":
                    console.log("Ongoing submission has been saved into history…");
                    break;
                default:
                    console.log("Ongoing submission could not be saved to history… (Exception while saving into database)");
            }
        },
        error: function(){
            console.log("Ongoing submission could not be saved to history… (Ajax exception)");
        }
    });
}

function setProofAjax(transaction_hash){
    $.ajax({
        type: "POST",
        url: '/ajax/proof/',
        headers: {
            'X-CSRFToken': csrf_token
        },
        data: {
            transaction_hash: transaction_hash
        },
        success: function(response){
            switch(response.result){
                case "true":
                    console.log("Ongoing submission has been moved into Certifications history…");
                    break;
                default:
                    console.log("Ongoing submission could not be moved into Certifications history… (Exception while saving into database)");
            }
        },
        error: function(){
            console.log("Ongoing submission could not be moved into Certifications history… (Ajax exception)");
        }
    });
}