const EscrowPaymentSplitter = artifacts.require('EscrowPaymentSplitter');
const UoA = artifacts.require('UoA');

// credit: https://ethereum.stackexchange.com/questions/48627/how-to-catch-revert-error-in-truffle-test-javascript/48629
async function catchRevert(promise, revertMessage) {
    try {
        await promise;
        throw null;
    }
    catch (error) {
        assert(error, 'Expected an error but did not get one');
        expectMsgBegin = 'Returned error: VM Exception while processing transaction: revert '+revertMessage;
        assert(error.message.startsWith(expectMsgBegin), 'Expected an error starting with "'+expectMsgBegin+'" but got "'+error.message+'" instead');
    }
};

contract('UnitOfAccounting ERC20', accounts => {
    it('Shoud show the appropriate balance increase after minting', () => {
        return UoA.deployed().then(instance => {
            return instance.mint.sendTransaction(accounts[0], 1000).then(() => {
                return instance.balanceOf(accounts[0]).then(balance => {
                    // balance is a BN and assertion works without toNumber(), but the error message is less comprehensive
                    assert.equal(balance.toNumber(), 1000, 'The minted amount could not be verified calling balanceOf()');
                });
            });
        });
    });
    it('Should show the appropriate balance changes after coin transfer', () => {
        return UoA.deployed().then(instance => {
            return instance.transfer(accounts[1], 100).then(() => {
                return Promise.all([instance.balanceOf(accounts[0]), instance.balanceOf(accounts[1])]).then(([balanceAcc0, balanceAcc1]) => {
                    assert.equal(balanceAcc0.toNumber(), 900, 'Balance of sender account was not reduced by amount sent');
                    assert.equal(balanceAcc1.toNumber(), 100, 'Balance of receipient account doesn\'t show amount received');
                });
            });
        });
    });
    it('Should show the appropriate allowance after a call to approve()', () => {
        return UoA.deployed().then(instance => {
            return instance.approve(accounts[1], 100).then(() => {
                return instance.allowance(accounts[0], accounts[1]).then(allowance => {
                    assert.equal(allowance.toNumber(), 100, 'Allowance for spender was not set to the appropriate amount');
                });
            });
        });
    });
});

contract('EscrowPaymentSplitter', accounts => {
    let slotId;
    let escrowBalance = 0;
    let slotAmount = 100;
    let fundedEscrowSlotId;
    it('Should open an escrow slot and emit the EscrowSlotOpened event', () => {
        return EscrowPaymentSplitter.deployed().then(instance => {
            return instance.openEscrowSlot(1, {recipients: [accounts[1]], amounts: [slotAmount]}).then(response => {
                assert.equal(response.logs[0].event, 'EscrowSlotOpened', 'An EscrowSlotOpened event was not emitted');
                assert.equal(response.logs[0].args.externalId.toNumber(), 1, 'The EscrowSlotOpened event should carry over the provided external ID');
                assert.equal(response.logs[0].args.slotId.toNumber(), 0, 'The escrow slot ID should be incrementing');
                slotId = response.logs[0].args.slotId.toNumber();
            });
        });
    });
    it('Should return the payment splitting definition provided on escrow slot setup when calling getPaymentSplittingDefinition()', () => {
        return EscrowPaymentSplitter.deployed().then(instance => {
            return instance.getPaymentSplittingDefinition(slotId).then(paymentSplittingDefinition => {
                // note: paymentSplittingDefinition.amounts is an array of strings, not numbers or BNs
                assert.equal(paymentSplittingDefinition.recipients[0], accounts[1], 'The payment splitting definition contains another address than planned');
                assert.equal(parseInt(paymentSplittingDefinition.amounts[0]), slotAmount, 'The payment splitting defnition contains another amount than planned');
            });
        });
    });
    it('Should escrow the appropriate amount of UoA when fundEscrowSlot() is called, and emit the EscrowSlotFunded event', () => {
        return Promise.all([EscrowPaymentSplitter.deployed(), UoA.deployed()]).then(([instance, uoaInstance]) => {
            let mintAmount = 1000;
            return uoaInstance.mint(accounts[0], mintAmount).then(() => {
                return uoaInstance.approve(instance.address, slotAmount);
            }).then(() => {
                return instance.fundEscrowSlot(slotId);
            }).then(response => {
                escrowBalance += slotAmount;
                fundedEscrowSlotId = slotId;
                assert.equal(response.logs[0].event, 'EscrowSlotFunded', 'An EscrowSlotFunded event was not emitted');
                assert.equal(response.logs[0].args.slotId.toNumber(), slotId, 'The escrow slot ID doesn\'t match');
                return Promise.all([uoaInstance.balanceOf(accounts[0]), uoaInstance.balanceOf(instance.address)]);
            }).then(([callerBalance, escrowBalance]) => {
                assert.equal(callerBalance.toNumber(), (mintAmount - slotAmount), 'UoA balance of caller account was not reduced by escrow slot value');
                assert.equal(escrowBalance.toNumber(), escrowBalance, 'UoA balance of escrow contract doesn\'t show the correct amount');
            });
        });
    });
    it('Should escrow the appropriate amount of UoA from a customer account when fundEscrowSlotFrom() is called, and emit the EscrowSlotFunded event', () => {
        return Promise.all([EscrowPaymentSplitter.deployed(), UoA.deployed()]).then(([instance, uoaInstance]) => {
            let mintAmount = 1000;
            return instance.openEscrowSlot(2, {recipients: [accounts[2]], amounts: [slotAmount]}).then(response => {
                slotId = response.logs[0].args.slotId.toNumber();
                return uoaInstance.mint(accounts[1], mintAmount);
            }).then(() => {
                return uoaInstance.approve(instance.address, slotAmount, {from: accounts[1]});
            }).then(() => {
                return instance.fundEscrowSlotFrom(slotId, accounts[1]);
            }).then(response => {
                escrowBalance += slotAmount;
                assert.equal(response.logs[0].event, 'EscrowSlotFunded', 'An EscrowSlotFunded event was not emitted');
                assert.equal(response.logs[0].args.slotId.toNumber(), slotId, 'The escrow slot ID doesn\'t match');
                return Promise.all([uoaInstance.balanceOf(accounts[1]), uoaInstance.balanceOf(instance.address)]);
            }).then(([customerBalance, escrowBalanceResponse]) => {
                assert.equal(customerBalance.toNumber(), (mintAmount - slotAmount), 'UoA balance of customer account was not reduced by escrow slot value');
                assert.equal(escrowBalanceResponse.toNumber(), escrowBalance, 'UoA balance of escrow contract doesn\'t show the correct amount');
            });
        });
    });
    
    it('Should return the appropriate state when calling isEscrowSlotFunded()', () => {
        return EscrowPaymentSplitter.deployed().then(instance => {
            return instance.isEscrowSlotFunded(slotId).then(state => {
                assert.equal(state, true, 'isEscrowSlotFunded() returned false for a funded slot');
                return instance.openEscrowSlot(3, {recipients: [accounts[2]], amounts: [slotAmount]});
            }).then(response => {
                slotId = response.logs[0].args.slotId.toNumber();
                return instance.isEscrowSlotFunded(slotId);
            }).then(state => {
                assert.equal(state, false, 'isEscrowSlotFunded() returned true for a slot which is not funded');
            });
        });
    });
    it('Should show the appropriate amount of escrowed UoA for a recipient when getEscrowedValue() is called', () => {
        return EscrowPaymentSplitter.deployed().then(instance => {
            return instance.getEscrowedValue(fundedEscrowSlotId, {from: accounts[1]}).then(value => {
                assert.equal(value, slotAmount, 'getEscrowedValue() returned wrong value for recipient'); 
            });
        });
    });
    it('Should distribute the appropriate UoA amounts when settleEscrowSlot() is called, and emit the EscrowSlotSettled event', () => {
        return Promise.all([EscrowPaymentSplitter.deployed(), UoA.deployed()]).then(([instance, uoaInstance]) => {
            let mintAmount = 2000;
            let slotRecipients = [accounts[2], accounts[3], accounts[4]];
            let slotAmountsPerCustomers = [slotAmount, slotAmount * 2, slotAmount * 11];
            let slotAmountTotal = 14 * slotAmount;
            return instance.openEscrowSlot(4, {recipients: slotRecipients, amounts: slotAmountsPerCustomers}).then(response => {
                slotId = response.logs[0].args.slotId.toNumber();
                return uoaInstance.mint(accounts[1], mintAmount);
            }).then(() => {
                return uoaInstance.approve(instance.address, slotAmountTotal, {from: accounts[1]});
            }).then(() => {
                return instance.fundEscrowSlotFrom(slotId, accounts[1]);
            }).then(() => {
                escrowBalance += slotAmountTotal;
                return instance.settleEscrowSlot(slotId, {from: accounts[1]});
            }).then(response => {
                escrowBalance -= slotAmountTotal;
                assert.equal(response.logs[0].event, 'EscrowSlotSettled', 'An EscrowSlotSettled event was not emitted');
                assert.equal(response.logs[0].args.slotId.toNumber(), slotId, 'The escrow slot ID doesn\'t match');
                return Promise.all([uoaInstance.balanceOf(instance.address), uoaInstance.balanceOf(slotRecipients[0]), uoaInstance.balanceOf(slotRecipients[1]), uoaInstance.balanceOf(slotRecipients[2])]);
            }).then(([escrowBalanceResponse, receipient0Balance, receipient1Balance, receipient2Balance]) => {
                assert.equal(escrowBalanceResponse.toNumber(), escrowBalance, 'UoA balance of escrow contract doesn\'t show the correct amount');
                assert.equal(receipient0Balance.toNumber(), slotAmountsPerCustomers[0], 'UoA balance of a recipient doesn\'t show the correct amount');
                assert.equal(receipient1Balance.toNumber(), slotAmountsPerCustomers[1], 'UoA balance of a recipient doesn\'t show the correct amount');
                assert.equal(receipient2Balance.toNumber(), slotAmountsPerCustomers[2], 'UoA balance of a recipient doesn\'t show the correct amount');
            });
        });
    });
    it('Should revert if another address than the consolidation serrvice (contract owner) calls openEscrowSlot()', () => {
        return EscrowPaymentSplitter.deployed().then(instance => {
            return catchRevert(instance.openEscrowSlot(5, {recipients: [accounts[2]], amounts: [slotAmount]}, {from: accounts[1]}), 'Ownable: caller is not the owner');
        });
    });
    it('Should revert if another address than the consolidation serrvice (contract owner) calls fundEscrowSlotFrom()', () => {
        return EscrowPaymentSplitter.deployed().then(instance => {
            return catchRevert(instance.fundEscrowSlotFrom(slotId, accounts[1], {from: accounts[1]}), 'Ownable: caller is not the owner');
        });
    });
    it('Should revert if fundEscrowSlot() is called on a slot which was already funded', () => {
        return EscrowPaymentSplitter.deployed().then(instance => {
            return catchRevert(instance.fundEscrowSlot(fundedEscrowSlotId, {from: accounts[0]}), 'Slot with ID '+fundedEscrowSlotId+' was already funded');
        });
    });
    it('Should revert if fundEscrowSlotFrom() is called on a slot which was already funded', () => {
        return EscrowPaymentSplitter.deployed().then(instance => {
            return catchRevert(instance.fundEscrowSlotFrom(fundedEscrowSlotId, accounts[1], {from: accounts[0]}), 'Slot with ID '+fundedEscrowSlotId+' was already funded');
        });
    });
    it('Should revert if somebody calls settleEscrowSlot() on a unfunded slot', () => {
        let instance;
        return EscrowPaymentSplitter.deployed().then(contractInstance => {
            instance = contractInstance;
            return instance.openEscrowSlot(6, {recipients: [accounts[1]], amounts: [slotAmount]});
        }).then((response) => {
            return catchRevert(instance.settleEscrowSlot(response.logs[0].args.slotId.toNumber()), 'Slot with ID '+response.logs[0].args.slotId.toNumber()+' was not funded and can\'t be settled');
        });
    });
    it('Should revert if another address than the payer calls settleEscrowSlot()', () => {
        return EscrowPaymentSplitter.deployed().then(instance => {
            return catchRevert(instance.settleEscrowSlot(fundedEscrowSlotId, {from: accounts[1]}), 'Slot can only be settled by payer');
        });
    });
    it('Should revert if getPaymentSplittingDefinition(), fundEscrowSlot(), fundEscrowSlotFrom(), isEscrowSlotFunded(), getEscrowedValue() or settleEscrowSlot() are called on a slot ID the contract doesn\'t know', () => {
        let instance;
        return EscrowPaymentSplitter.deployed().then(contractInstance => {
            instance = contractInstance;
            return catchRevert(instance.getPaymentSplittingDefinition(100), 'Slot with ID 100 doesn\'t exist');
        }).then(() => {
            return catchRevert(instance.fundEscrowSlot(100), 'Slot with ID 100 doesn\'t exist');
        }).then(() => {
            return catchRevert(instance.fundEscrowSlotFrom(100, accounts[1]), 'Slot with ID 100 doesn\'t exist');
        }).then(() => {
            return catchRevert(instance.isEscrowSlotFunded(100), 'Slot with ID 100 doesn\'t exist');
        }).then(() => {
            return catchRevert(instance.getEscrowedValue(100), 'Slot with ID 100 doesn\'t exist');
        }).then(() => {
            return catchRevert(instance.settleEscrowSlot(100), 'Slot with ID 100 doesn\'t exist');
        });
    });
});

