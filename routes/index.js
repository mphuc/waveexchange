'use strict'

const express = require('express');
const UserController = require('../controllers/user');
const request = require('request');
const crlUserLogin = require('../controllers/user/login');
const crlUserActive = require('../controllers/user/active');
const crlUserRegister = require('../controllers/user/register');

const HomeController = require('../controllers/home');
const InvestController = require('../controllers/invest');
const DashboardController = require('../controllers/dashboard');
const SettingController = require('../controllers/setting');
const AffiliateController = require('../controllers/affiliate');
const ExchangeController = require('../controllers/exchange');
const FaqController = require('../controllers/faq');
const PartnershipsController = require('../controllers/partnerships');
const HistoryController = require('../controllers/history');
const WithdrawController = require('../controllers/withdraw');
const WalletController = require('../controllers/wallet');
const auth = require('../middlewares/auth');
const capchaControlelr = require('../controllers/capcha');
const InviteController = require('../controllers/invite');
const BalanceController = require('../controllers/balance');
const IcoCtrl = require('../controllers/ico');
const Auto_crontab = require('../controllers/auto');
const SupportController = require('../controllers/support');
const SetupCtrl = require('../controllers/setup');
const TickerCtrl = require('../controllers/ticker');
const router = express.Router();


router.get('/support', auth, SupportController.Index);
router.get('/new-support', auth, SupportController.NewSupport);
router.post('/account/support/new-support', auth, SupportController.SubmitNewSupport);
router.get('/support/ticket/:token', auth, SupportController.ViewTicker);
router.post('/account/support/reply-support', auth, SupportController.SubmitReplySupport);


//router.get('/account/dashboard', auth, DashboardController.IndexOn);


//router.post('/account/transfer', auth, DashboardController.TransferToCoin);

/*router.get('/account/invest', auth, InvestController.IndexOn);
router.get('/lending', auth, InvestController.DepositS);
router.post('/account/invest', auth, InvestController.InvestSubmit);
router.post('/account-deposits.html', auth, InvestController.LoadDeposit);
router.get('/test', auth, InvestController.test);

router.get('/account/withdraw', auth, WithdrawController.Index);
router.post('/account/withdraw', auth, WithdrawController.WithdrawSubmit);
router.post('/account/loadWithdraw', auth, WithdrawController.LoadDataWithdraw);
router.get('/de495b769293abf4edf3e08a021a', WithdrawController.active);
*/
router.post('/account/wallet', auth, WalletController.Index);

router.get('/setting', auth, SettingController.Index);

var multer  = require('multer');
var upload = multer({ dest: '/tmp/'});
router.post('/account/setting/file_upload',auth,upload.single("file"), SettingController.Uploadfile);

router.post('/account/setting/personal', auth, SettingController.updatePersonal);
router.post('/account/setting/authy', auth, SettingController.authy);
router.post('/account/setting/password', auth, SettingController.changePasswrd);
router.get('/tokenactive', SettingController.active);

router.get('/affiliate', auth, AffiliateController.Indexmain);
router.get('/account/affiliate/tree', auth, AffiliateController.Treerefferal);
router.get('/account/affiliate/refferal', auth, AffiliateController.Indexrefferal);
router.get('/account/affiliate/promo-materials', auth, AffiliateController.Indexpromo);
router.post('/account/refferal', auth, AffiliateController.getRefferal);
// history
// router.get('/history.html', auth, HistoryController.HistoryHtml);
router.post('/account/transaction', auth, HistoryController.Index);

//Invite Friends
router.get('/invite-friend', auth, InviteController.InviteHtml);
// Exchange
router.get('/exchange',  ExchangeController.Index);


router.get('/balance', auth, BalanceController.Balance);

router.post('/account/balance/withdraw', auth, BalanceController.SubmitWithdraw);
router.post('/account/balance/wallet', auth, BalanceController.GetWallet);

router.get('/account/balance/history-withdraw-pending', auth, BalanceController.getWithdraw_user_pendding);
router.get('/account/balance/history-deposit-pending', auth, BalanceController.getDeposit_user_pendding);

router.get('/account/balance/history-withdraw-finish', auth, BalanceController.getWithdraw_user_finish);
router.get('/account/balance/history-deposit-finish', auth, BalanceController.getDeposit_user_finish);
router.post('/account/balance/remove-withdraw', auth, BalanceController.Remove_Withdraw);
router.get('/token_crt', auth, BalanceController.create_token);


router.get('/wallet/walletnotify/:txid', WalletController.Notify);
router.get('/wallet/walletnotifybtc/:txid', WalletController.NotifyBTC);
//router.get('/wallet/walletnotifybtg/:txid', WalletController.NotifyBTG);



router.get('/two-factor-auth', UserController.getAuthy);
router.get('/logout', UserController.logOut);

router.get('/signup', crlUserRegister.getTemplateRegister);
//router.get('/register-success', crlUserRegister.getTemplateSuccess);
router.post('/signUp', crlUserRegister.signUp);

router.post('/Authy', UserController.checkAuthy);

router.post('/signIn', crlUserLogin.signIn);
router.get('/verify-account', crlUserActive.active);
//router.get('/active', crlUserActive.active);
router.get('/change-password', crlUserLogin.ChangePassword);
router.post('/change-password-submit', crlUserLogin.ChangePasswordSubmit);

router.get('/forgot-password', crlUserLogin.getTemplateforgot);
router.post('/ForgotPassword', crlUserLogin.ForgotPassword);

router.get('/signin', crlUserLogin.getTemplateLogin);

router.get('/resend-active-email', crlUserLogin.ResendMailTempalte);
router.post('/ResendMail', crlUserLogin.ResendMailSubmit);

// FAQS
router.get('/faq',FaqController.Index);


router.get('/test', auth , (req,res)=>{ 
	res.status(200).send({message: req.session});
});

router.get('/api/auth', auth);


// Template Home
//router.get('/', HomeController.getTemplateHome);

//router.get('/InfoSTC', HomeController.InfoSTC);
//router.get('/blog-detail', HomeController.getTemplateBlogDetail);
//router.get('/guide.html', HomeController.howtobuy);

// Ico Submit
//router.get('/ico',auth, IcoCtrl.IndexOn);
//router.post('/account/ico/sumit-buy',auth, IcoCtrl.SumitBuy);
//router.post('/account/ico/price-coin-alt',auth, IcoCtrl.GetPriceByICO);
router.get('/get-price-coin', IcoCtrl.get_price_coin);

//capcha Image
router.get('/capcha.png', capchaControlelr.capchaImage);
//router.get('/test_mail', crlUserLogin.test_mail);


router.post('/callback-coinpayment-qwtryqweqeweqeqwe', BalanceController.CallbackCoinpayment);
router.get('/callback-coinpayment-qwtryqweqeweqeqwe', BalanceController.CallbackCoinpayment);


//const TickerCtrl = require('../controllers/ticker');
//router.get('/ticker', TickerCtrl.Index);
router.get('/api/price', TickerCtrl.LoadPrice);

//Setup
//const SetupCtrl = require('../controllers/setup');
router.get('/setup', SetupCtrl.Setup);


router.get('/demo', (req,res)=>{
var moments = require('moment-timezone');

const moment = require('moment');
	var date1 = "2017-10-15 23:59:59"
	// date1 = moments(date1).tz("Asia/Hong_Kong").format();
	date1 = moment(date1).format('MM/DD/YYYY LT');
	var date2 = Date.now();
	console.log(moment(date2).format('MM/DD/YYYY LT'));
	// date2 = moments(date2).tz("Asia/Hong_Kong").format();
	date2 = moment(date2).format('MM/DD/YYYY LT');
	console.log(date1);
	console.log(date2);
   

	if (date1 > date2) {
	  res.status(200).send({'a': 1, 'date1': date1, 'date2': date2});
	} else {
	  res.status(200).send({'a': 2, 'date2': date2, 'date1': date1});
	}

	
});

module.exports = router;