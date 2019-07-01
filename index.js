
// Ladda in moduler
const { dialog } = require('electron').remote;
const fs = require('fs')
var d3 = require('d3');

//----------------------------------------------------
// Sidans "tillstånd" - vilka kurser finns, vilken är den aktuella, vilka elever, prov har valts
//----------------------------------------------------
const state = {folder: '', kurser: {}, kurs: {}, selection: {}};

// Templates
const kurserTemplate = [ { id: 0, namn: '', grupp: '', filename: ''} ];
const kursTemplate = { id: 0, namn: '', grupp: '', elever: [] };
const elevTemplate = { id: 0, namn: '', uppg: [] };
const nivaer = ['E', 'C', 'A'];
const formagor = ['B', 'P', 'PL', 'M', 'R', 'K'];
const nivaformagor = [];
for (i in nivaer) {
	for (j in formagor) {
		nivaformagor.push({ niva: nivaer[i], formaga: formagor[j]})
	};
};

//----------------------------------------------------
// Hämta data från localstorage och ladda lista med kurser
//----------------------------------------------------
const userData = window.localStorage;
if (!userData.folder) {
/*	modalMessage('Välkommen', 
		'Det ser ut som att det är första gången du använder programmet. <br>' + 
		'Välj en mapp där du vill spara data. <br>'+
		'Om du redan har en sådan mapp, välj den.');*/
	userData.folder = dialog.showOpenDialog({properties: ['openDirectory']})[0]
};
state.folder = userData.folder;
if (checkFS('kurser.json')) {
	state.kurser = loadJSON('kurser.json');
	kursModal();	
} else {
	writeJSON('kurser.json', []);
	state.kurser = loadJSON('kurser.json');
	kursModal();
};


//----------------------------------------------------
// On-click events
//----------------------------------------------------
d3.select('#kurs-namn').on('click',kursModal);
d3.select('#elever').on('click', elevModal);
d3.select('#prov').on('click', provModal);









//----------------------------------------------------
// Update elements and lists
//----------------------------------------------------
function updateKurs() {
	d3.select('#kurs-namn').text(state.kurs.namn);
	d3.select('#grupp-namn').text(state.kurs.grupp);	
	// state.selection = {elev: state.kurs.elev[0].namn, prov: state.kurs.prov}; 
	updateElever()
	updateProv()
	updateMatris()
};

function updateElever() {
	let eleverList = d3.select('#elever-list');
	let elever = eleverList.selectAll('div').data(state.kurs.elever);

	// Update
	elever.text( (d) => d.namn );

	// Enter
	let eleverEnter = elever.enter().append('div');
	eleverEnter.text( (d) => d.namn );

	// Exit
	elever.exit().remove();
};

function updateProv() {
	let prov = [];
	if (state.kurs.elever.length>=1) {
		prov = [...new Set(state.kurs.elever[0].uppg.map(x=>x.prov))];
	};
	let provList = d3.select('#prov-list');
	let proven = provList.selectAll('div').data(prov);

	// Update
	proven.text( function(d) {return d;});

	// Enter
	let provenEnter = proven.enter().append('div');
	provenEnter.text( function(d) { return d;} );

	// Exit
	proven.exit().remove();
};


function updateMatris() {
	let matrisElement = d3.select('.right-grid').selectAll('.matris-element').data(nivaformagor);
	let svg = matrisElement.enter()
		.append('div')
		.attr('class', 'matris-element')
		.style('grid-area', function(d) {
			return d.niva + d.formaga;
		})
		.append('svg').attr('width', '100%')
		.attr('viewBox','0 0 100 50').attr('preserveAspectRatio',"xMidYMid meet");

	//function filterData(data, niva, formaga) {
	//	data = data.filter(item => ((item.niva == niva)&&(item.formaga == formaga)));
	//};
	let data = state.kurs.elever[0].uppg;
	let m = nMax(data); 

	//let data = state.kurs.elever.filter( (x) => (x.namn == state.selection.namn)); // find?
	//data = data[0].uppg.filter( (x) => ( state.selection.prov.includes(x.prov) )); 
	//let groups = svg.selectAll('g').data( (d) => filterData(data, d.niva, d.formaga) );
	let groups = svg.selectAll('g').data(function(d) {
		let data2 = filterData(data, d.niva, d.formaga).sort(function(x, y){ return d3.ascending(x.nr, y.nr);});
		return layout(data2,m);
	});

	// Update
	groups.select('circle')
		.attr('cx', d => d.x)
		.attr('cy', d => d.y)
		.attr('r', d => d.r)
		.attr('class', d => d.className);
	groups.select('text')
		.attr('x', d => d.x)
		.attr('y', d => d.y)
		.attr('class', 'uppgText')
		.text(d => d.nr);

	// Enter
	let groupsEnter = groups.enter().append('g');
	groupsEnter.append('circle')
		.attr('cx', d => d.x)
		.attr('cy', d => d.y)
		.attr('r', d => d.r)
		.attr('class', d => d.className);
	groupsEnter.append('text')
		.attr('x', d => d.x)
		.attr('y', d => d.y)
		.attr('class', 'uppgText')
		.text(d => d.nr);
	
	// Exit
	groups.exit().remove();
};







//----------------------------------------------------
// Modals
//----------------------------------------------------
function kursModal() {
	d3.select('#modal-background').style('display', 'block');
	d3.select('#modal-title').text('Kurser');
	modalContent = d3.select('#modal-content');
	kursElems = modalContent.selectAll('p').data(state.kurser);

	//Update
	kursElems.html(function(d) {return d.namn + d.grupp});

	//Enter
	kursElemsEnter = kursElems.enter().append('p').attr('class', 'h4');
	kursElemsEnter.html(function(d) {return d.namn + '   ' + d.grupp});
	kursElemsEnter.on('click', function(d) {
		state.kurs = loadJSON(d.filename);
		updateKurs();
		closeModal();
	});

	//Exit
	kursElems.exit().remove();

	modalContent.append('hr');
	modalContent.append('span').html('Ny kurs:');
	modalContent.append('input').attr('type', 'text').attr('placeholder','Kursnamn').attr('id', 'kurs-input');
	modalContent.append('input').attr('type', 'text').attr('placeholder','Gruppnamn').attr('id', 'grupp-input');
	modalContent.append('a').attr('class', 'button').text('Lägg till').on('click', function() {
		let kursNamn = d3.select('#kurs-input').property('value');
		let gruppNamn = d3.select('#grupp-input').property('value');
		let kursId = findUniqueId(state.kurser);
		let kursData = { id: kursId, namn: kursNamn, grupp: gruppNamn };
		kursData.filename = generateFileName(kursData);
		state.kurser.push(kursData);
		writeJSON('kurser.json', state.kurser);
		writeJSON(kursData.filename, { id: kursId, namn: kursNamn, grupp: gruppNamn, elever: [{id: 0, namn: 'Alla elever', uppg: []}] });
		state.kurs = loadJSON(kursData.filename);
		updateKurs();
		closeModal()
	});
	d3.select('#modal-close').on('click', closeModal);
}

function elevModal() {
	d3.select('#modal-background').style('display', 'block');
	d3.select('#modal-title').text('Lägg till elever:');
	modalContent = d3.select('#modal-content');	
	modalContent.append('textarea')
			.attr('id', 'elev-namn-input')
			.attr('rows', 3)
			.attr('class', 'input-list')
			.style('width', '25%');
	modalContent.append('a').attr('class', 'button').text('Lägg till').on('click', function() {
		let elever = d3.select('#elev-namn-input').property('value').split('\n');
		elever.forEach( (elev) => state.kurs.elever.push( 
			{
				id: findUniqueId(state.kurs.elever),
				namn: elev,
				uppg: []
			}
			));
		writeJSON( generateFileName(state.kurs), state.kurs );
		updateElever();
		closeModal();
	});
}

function provModal() {
	d3.select('#modal-background').style('display', 'block');
	d3.select('#modal-title').text('Lägg till prov:');
	modalContent = d3.select('#modal-content');
	modalContent.append('input').attr('type', 'text').attr('placeholder','Provnamn').attr('id', 'prov-namn-input');
	modalContent.append('textarea')
			.attr('id', 'prov-uppg-input')
			.attr('rows', 5)
			.attr('class', 'input-list');
	enableTab('prov-uppg-input');
	modalContent.append('a').attr('class','button').text('Lägg till').on('click', function() {
		let provnamn = d3.select('#prov-namn-input').property('value')
		let uppgifter = d3.select('#prov-uppg-input').property('value').split('\n');
		uppgifter.forEach( function(uppg) {
			uppg = uppg.split('\t');
			for (i in state.kurs.elever) {
				state.kurs.elever[i].uppg.push({
					id: findUniqueId(state.kurs.elever[i].uppg),
					prov: provnamn,
					nr: uppg[0],
					niva: uppg[1],
					formaga: uppg[2],
					kriterie: uppg[3],
					res: 0
				});
			};
			writeJSON( generateFileName(state.kurs), state.kurs );
			updateProv();
			closeModal();
		} );
	});
};




















//----------------------------------------------------
// Helper functions
//----------------------------------------------------
function checkFS(filename) {
	try { return fs.existsSync(state.folder + '/' + filename); }
	catch(err) { console.error(err); }
};

function loadJSON(filename) {
	try { return JSON.parse(fs.readFileSync(state.folder + '/' + filename)) }
	catch(err) { console.error(err); }
};

function writeJSON(filename, object) {
	fs.writeFileSync(state.folder +'/' + filename, JSON.stringify(object), 'utf-8');
};

function generateFileName(kurs) {
	return kurs.namn + '-' + kurs.grupp + '-' + kurs.id + '.json';
};

function findUniqueId(array) {
	if (array.length==0) {
		return 0;
	} else {
		return array.reduce( (id, elem) => (id<=elem.id)?elem.id+1:id, 0);
	};
};

function openModal() {
	d3.select('#modal-background').style('display', 'block');
};
function closeModal() {
	d3.select('#modal-background').style('display', 'none');
	d3.select('#modal-title').text('');
	d3.select('#modal-content').html('');
};

function modalMessage(title, content) {
	openModal();
	d3.select('#modal-title').text(title);
	d3.select('#modal-content').html(content);
	d3.select('#modal-close').on('click', closeModal);
};

function allaUppgifter(kurs) {
	return kurs.elever.reduce( (uppg, elev) => uppg.concat(elev.uppg) );
	/*
	let uppg = [];
	for (i in kurs.elever) {
		uppg.concat(kurs.elever[i].uppg);
	};
	*/
};

// ----------------------------------------
// Hjälpfunktion för att tillåta <tab> i textarea
// ----------------------------------------
function enableTab(id) {
    var el = document.getElementById(id);
    el.onkeydown = function(e) {
        if (e.keyCode === 9) { // tab was pressed

            // get caret position/selection
            var val = this.value,
                start = this.selectionStart,
                end = this.selectionEnd;

            // set textarea value to: text before caret + tab + text after caret
            this.value = val.substring(0, start) + '\t' + val.substring(end);

            // put caret at right position again
            this.selectionStart = this.selectionEnd = start + 1;

            // prevent the focus lose
            return false;

        }
    };
};

function kvot(a,b) {
	return (a-(a%b))/b;
};
//let formagaList = ['B', 'P', 'PL', 'M', 'R', 'K'];
//let nivaList = ['E', 'C', 'A'];


function filterData(data, niva, formaga) {
	return data.filter(item => ((item.niva == niva)&&(item.formaga == formaga)));
};

function nMax(data) {
	let nMax = 0;
	for (i in nivaer) {
		for (j in formagor) {
			n = data.filter(item => ((item.niva == nivaer[i])&&(item.formaga == formagor[j]))).length;
			nMax = Math.max(n, nMax);
		}
	};
	return nMax;
};

function layout(data, m) {
	let ncols = Math.ceil(Math.sqrt(2*(m)));
	let q = kvot(m, ncols);
	let nrows = ( m%ncols == 0 ) ? q : q+1;
	let r = Math.min(100/(2*ncols) , 50/(2*nrows), 12);
	let margin = 1;
	data = data.map((obj, i) => ({ ...obj, 
		x : 0.5*margin + r + 2*r*(i%ncols), 
		y: 0.5*margin + r + 2*r*kvot(i,ncols),
		r: r-margin,
		className: 'res' + obj.res,
		mMax: m
	}));
	return data;
};

