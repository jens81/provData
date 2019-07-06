
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

state.selection = {
	elev: {}, // hela elevobjektet
	prov: [], // provlista (erhålls från funktion, se nedersta delen av filen)
	listview: false, // för lista istället för matris
	unlockable: false,
	datasize: 'small',
	uppg: [], // filtrerade uppgifter {id: 0, nr: '', niva: '', formaga: '', res: 0} osv.
	nMax: 0,
	matris: [], // Ett element för varje niva/formaga {niva: '', formaga: '', uppgifter = [] } där uppgifter är filtrerat efter elev, prov och niva/formaga
	update: function() {
		this.uppg = this.elev.uppg.filter( uppg => this.prov.includes(uppg.prov) );
		this.unlockable = ((this.prov.length==1)&&(this.elev.namn!='Alla elever'));
		if (this.unlockable) {
			d3.select('#lock').style('color', 'black');
			d3.select('#lock2').style('color', 'black');
		} else {
			d3.select('#lock').attr('class', 'icon-lock').style('color', 'gray');
			d3.select('#lock2').attr('class', 'icon-lock').style('color', 'gray');
		};
		let nMax = 0;
		for (i in nivaformagor) {
			let niva = nivaformagor[i].niva;
			let formaga = nivaformagor[i].formaga;
			let uppgifter = this.uppg.filter(item => ((item.niva == niva)&&(item.formaga == formaga)));
			n = uppgifter.length;
			// Denna behöver vara utanför (just nu är det nuvarande nMax som används i layout -> olika för olika rutor)
			nMax = Math.max(n, nMax);
		};
		this.nMax = nMax;
		let matris = [];
		if (this.nMax<=15) {
			this.datasize = 'small';
		} else if (this.nMax<28) {
			this.datasize = 'medium';
		} else {
			this.datasize = 'large';
		};
		for (i in nivaformagor) {
			let niva = nivaformagor[i].niva;
			let formaga = nivaformagor[i].formaga;
			let uppgifter = this.uppg.filter(item => ((item.niva == niva)&&(item.formaga == formaga)));
			if (this.datasize!='small') {
				uppgifter.sort(function(x,y) {
					return d3.descending(x.res, y.res);
				})
			};
			// Calculate percentage
			let percentage = 50*uppgifter.reduce( (sum, uppg) => sum + (uppg.res || 0), 0) / uppgifter.length;
			percentage = (isNaN(percentage))?0:Math.round(percentage);
			matris.push(
				{
					niva: niva,
					formaga: formaga,
					percentage: percentage,
					uppg: layout(uppgifter,this.nMax)
				}
			);
		};
		this.matris = matris;
	}
}

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
d3.select('#lock').on('click', function() {
	let icon = d3.select('#lock');
	if ((state.selection.unlockable)&&(icon.classed('icon-lock'))) {
		icon.attr('class', 'icon-lock-open-alt');
	} else {
		icon.attr('class', 'icon-lock');
	};
});
d3.select('#lock2').on('click', function() {
	let icon = d3.select('#lock2');
	if ((state.selection.unlockable)&&(icon.classed('icon-lock'))) {
		icon.attr('class', 'icon-lock-open-alt');
	} else {
		icon.attr('class', 'icon-lock');
	};
});
d3.select('#view').on('click', function() {
	state.selection.listview = true;
	d3.select('#matris-container').style('display', 'none');
	d3.select('#list-container').style('display', 'block');
	updateView();
});
d3.select('#view2').on('click', function() {
	state.selection.listview = false;
	d3.select('#list-container').style('display', 'none');
	d3.select('#matris-container').style('display', 'grid');
	updateView();
});
d3.select('#to-csv').on('click', () => exportCSV(state.kurs));



var tooltip = d3.select("body")
    .append("div")
    .attr('class', 'tooltip')
    .style("position", "absolute")
    .style("z-index", "10")
    .style("visibility", "hidden")
    .text("a simple tooltip");










//----------------------------------------------------
// Update elements and lists
//----------------------------------------------------
function updateKurs() {
	d3.select('#kurs-namn').text(state.kurs.namn);
	d3.select('#grupp-namn').text(state.kurs.grupp);
	state.selection.update()	
	updateElever()
	updateProv()
	updateView()
};
function updateElever() {
	let eleverList = d3.select('#elever-list');
	let elever = eleverList.selectAll('.list-item').data(state.kurs.elever);

	// Update
	elever.text( (d) => d.namn ).classed('on', d => (d.namn==state.selection.elev.namn));

	// Enter
	let eleverEnter = elever.enter().append('div').attr('class', 'list-item');
	eleverEnter.text( (d) => d.namn );
	eleverEnter.classed('on', d => (d.namn==state.selection.elev.namn));
	eleverEnter.on('click', function(d) {
		d3.select('#elever-list').selectAll('.list-item').classed('on', false);
		d3.select(this).classed('on', true);
		state.selection.elev = d;
		//state.selection.update();
		updateView();
	});

	// Exit
	elever.exit().remove();
};
function updateProv() {
	let prov = [];
	if (state.kurs.elever.length>=1) {
		prov = allaProv(state.kurs);
	};
	let provList = d3.select('#prov-list');
	let proven = provList.selectAll('.list-item').data(prov);

	// Update
	proven.text( function(d) {return d;}).classed('on', d => state.selection.prov.includes(d));

	// Enter
	let provenEnter = proven.enter().append('div').attr('class', 'list-item');
	provenEnter.classed('on', d => (state.selection.prov.includes(d)))
	provenEnter.text( function(d) { return d;} );
	provenEnter.on('click', function(d) {
		if (state.selection.prov.includes(d)) {
			state.selection.prov = state.selection.prov.filter(prov => (prov!=d));
		} else {
			state.selection.prov.push(d);
		};
		d3.select("#prov-list").selectAll('.list-item')
			.classed('on', d => (state.selection.prov.includes(d)));
		//state.selection.update();
		//update();
		updateView();
	});

	// Exit
	proven.exit().remove();
};
function updateMatris() {
	let matrisElement = d3.select('.matris-grid').selectAll('.matris-element').data(state.selection.matris);
	// Update
	let svgElement = matrisElement.select('svg');
	svgElement.each(updateElement);
	// Enter
	let matrisElementEnter = matrisElement.enter()
		.append('div')
		.attr('class', 'matris-element')
		.style('grid-area', d => d.niva + d.formaga);
	let svgElementEnter = matrisElementEnter.append('svg')
		.attr('width', '100%')
		.attr('viewBox','0 0 100 50').attr('preserveAspectRatio',"xMidYMid meet");
	svgElementEnter.each(updateElement);
	// Exit
	svgElement.exit().remove();

	function updateElement() {
		let svg = d3.select(this);
		let groups = svg.selectAll('g').data(d => d.uppg);

		// Update
		groups.select('circle')
			.attr('cx', s => s.x)
			.attr('cy', s => s.y)
			.attr('r', s => s.r)
			.attr('class', s => s.className)
			.attr('opacity', (state.selection.datasize=='large')?0.5:1);
		groups.select('text')
			.attr('x', s => s.x)
			.attr('y', s => s.y)
			.attr('class', 'uppgText')
			.text(s => s.nr)
			.attr('visibility', (state.selection.datasize=='small')?'visible':'hidden');
		// Enter
		let groupsEnter = groups.enter().append('g');
		groupsEnter.append('circle')
			.attr('cx', s => s.x)
			.attr('cy', s => s.y)
			.attr('r', s => s.r)
			.attr('class', s => s.className)
			.attr('opacity', (state.selection.datasize=='large')?0.5:1);
		groupsEnter.append('text')
			.attr('x', s => s.x)
			.attr('y', s => s.y)
			.attr('class', 'uppgText')
			.text(s => s.nr)
			.attr('visibility', (state.selection.datasize=='small')?'visible':'hidden');
		groups.on('click', function(s) {
			if (d3.select('#lock').attr('class')=='icon-lock-open-alt') {
				s.res = (s.res + 1)%3;
				let elevId = state.selection.elev.id;
				let uppgId = s.id;
				state.kurs.elever[elevId].uppg[uppgId].res = s.res;
				updateAllaElever();
				writeJSON( generateFileName(state.kurs), state.kurs );
				//state.selection.update();
				updateView();
			};
		});
		// Exit
		groups.exit().remove();

		// Display percentage
		let percentText = svg.select('#percent-text');
		let percentBackground = svg.select('#percent-background');
		if (!percentText.empty()) {percentText.remove(); percentBackground.remove()};
		svg.append('text').attr('x', 50).attr('y', 25).attr('id', 'percent-text')
			.text(d=>d.percentage+'%')
			.style('font-size', '28pt')
			.style('font-family', 'Soleto-XBold')
			.style('text-anchor', 'middle')
			.style('alignment-baseline', 'middle')
			.style('stroke', 'white')
			.style('stroke-width', '1.25pt')
			.style('fill', function(d) {
				if (d.percentage>70) {
					return 'darkgreen';
				} else if (d.percentage>40) {
					return 'gold';
				} else {
					return '#e1e1e1';
				};
			})
			.style('visibility', (state.selection.datasize=='large')?'visible':'hidden');

		tooltip.attr('classed', 'left')
		groupsEnter.on('mouseover', function(s){ 
			tooltiphtml = (state.selection.datasize=='small')? '<b>'+s.prov+'</b><br>'+s.kriterie : '<b>'+s.prov+'</b><br><b> '+s.nr+'</b> | '+s.kriterie; 
			tooltip.html(tooltiphtml); 
			return tooltip.style("visibility", "visible");});
		groupsEnter.on("mousemove", function(){return tooltip.style("top", (d3.event.pageY+10)+"px").style("left",(d3.event.pageX - 100)+"px");})
	    groupsEnter.on("mouseout", function(){return tooltip.style("visibility", "hidden");});
	};
	//updateList();
	//updateView();
};


function updateList() {
	let listData = []
	if (state.selection.elev.namn=='Alla elever') {
		listData = filterWithAverage();
	} else {
		listData = state.selection.uppg;
	};
	let uppgiftList = d3.select('#uppgift-list');
	let uppgiftRow = uppgiftList.selectAll('.list-grid').data(listData);

	// Update
	let nr = uppgiftRow.select('.nr');
	let svgNr = nr.select('svg');
	let group = svgNr.select('g');
	group.select('circle').attr('class', d => (state.selection.elev.namn=='Alla elever')?'res-neutral':'res'+d.res);
	group.select('text').text(d => d.nr);
	nr.select('span')
		.text(d => (state.selection.elev.namn=='Alla elever')?d.percentage+'%':'')
		.style('color', function(d) {
			if (d.percentage>70) {
				return 'green';
			} else if (d.percentage>40) {
				return 'gold';
			} else {
				return 'gray';
			};
		});
	uppgiftRow.select('.typ').html(function(d) {return d.niva + '<sub>' + d.formaga + '</sub>';});
	uppgiftRow.select('.kriterie').text(function(d) {return d.kriterie;});

	// Enter
	let uppgiftRowEnter = uppgiftRow.enter().append('div').attr('class', 'list-grid');
	//uppgiftRowEnter.append('div').attr('class','nr').text(function(d) {return d.nr});
	let nrEnter = uppgiftRowEnter.append('div').attr('class','nr')
	let svgNrEnter = nrEnter.append('svg');
	svgNrEnter.attr('width', '100%').attr('viewBox','0 0 100 50').attr('preserveAspectRatio',"xMidYMid meet");
	groupEnter = svgNrEnter.append('g');
	groupEnter.append('circle').attr('cx', 50).attr('cy', 25).attr('r', 20)
		.attr('class', d => (state.selection.elev.namn=='Alla elever')?'res-neutral':'res'+d.res);
	groupEnter.append('text').attr('x', 50).attr('y', 25).attr('class', 'uppgNr').text(d => d.nr);
	groupEnter.on('click', function(s) {
		if (d3.select('#lock2').attr('class')=='icon-lock-open-alt') {
			s.res = (s.res + 1)%3;
			let elevId = state.selection.elev.id;
			let uppgId = s.id;
			state.kurs.elever[elevId].uppg[uppgId].res = s.res;
			updateAllaElever();
			writeJSON( generateFileName(state.kurs), state.kurs );
			//state.selection.update();
			updateView();
			//updateList();
		};
	});
	nrEnter.append('span').style('font-weight', 'bolder')
		.text(d => (state.selection.elev.namn=='Alla elever')?d.percentage+'%':'')
		.style('color', function(d) {
			if (d.percentage>70) {
				return 'green';
			} else if (d.percentage>40) {
				return 'gold';
			} else {
				return 'gray';
			};
		});
	uppgiftRowEnter.append('div').attr('class','typ').html(function(d) {return d.niva + '<sub>' + d.formaga + '</sub>';});
	uppgiftRowEnter.append('div').attr('class','kriterie').text(function(d) {return d.kriterie;});

	// Exit
	uppgiftRow.exit().remove();
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
		state.selection.elev = state.kurs.elever[0];
		state.selection.prov = allaProv(state.kurs);
		state.selection.update()
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
				uppg: allaUppgifter(state.kurs)
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
			updateAllaElever();
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


// ----------------------------------------
// Modal (bör uppdateras och snyggas till)
// ----------------------------------------
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

// ----------------------------------------
// Hjälpfunktioner för att få alla uppgifter / prov
// ----------------------------------------
function allaUppgifter(kurs) {
	return kurs.elever.reduce( (uppg, elev) => (elev.namn!='Alla elever')?uppg.concat(elev.uppg):uppg, [] );
};

function updateAllaElever() {
	state.kurs.elever[0].uppg = state.kurs.elever.reduce( (uppg, elev) => (elev.namn!='Alla elever')?uppg.concat(elev.uppg):uppg, [] );
};

function allaProv(kurs) {
	return [...new Set(kurs.elever[0].uppg.map(x=>x.prov))]
}

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


function exportCSV(kurs) {
	if (!(Object.keys(state.kurs).length==0)) {
		csvFileName = kurs.namn + '-' + kurs.grupp + '-' + kurs.id + '.csv';
		let csvContent = '';
		if (kurs.elever.length>1) {
			csvContent += kurs.elever[1].uppg.reduce( (rowString, uppg) => rowString + ',' + uppg.prov, '') + '\n';
			csvContent += kurs.elever[1].uppg.reduce( (rowString, uppg) => rowString + ',' + uppg.nr, '') + '\n';
			csvContent += kurs.elever[1].uppg.reduce( (rowString, uppg) => rowString + ',' + uppg.niva, '') + '\n';
			csvContent += kurs.elever[1].uppg.reduce( (rowString, uppg) => rowString + ',' + uppg.formaga, '') + '\n';
		};

		kurs.elever.slice(1).forEach( elev => csvContent += elev.namn + ',' + elev.uppg.reduce((rowString, uppg) => rowString + uppg.res + ',', '') + '\n');
		fs.writeFileSync(state.folder +'/' + csvFileName, csvContent, {encoding:'utf8',flag:'w'});
		modalMessage('Exportera CSV: Klart', 'Kursen har exporterats till csv med filnamn: <br>' + state.folder + '/' + csvFileName)
	} else {
		modalMessage('Exportera CSV: Misslyckat', 'Ingen kurs är vald, eller den går inte att exportera.')
	}
};


// ----------------------------------------
// Hjälpfunktioner för layout
// ----------------------------------------
function kvot(a,b) {
	return (a-(a%b))/b;
};
function layout(data, m) {
	let ncols = Math.ceil(Math.sqrt(2*(m)));
	let q = kvot(m, ncols);
	let nrows = ( m%ncols == 0 ) ? q : q+1;
	let r = Math.min(100/(2*ncols) , 50/(2*nrows), 12);
	let margin = 1;
	let layout = data.map((obj, i) => ({ ...obj, 
		x : 0.5*margin + r + 2*r*(i%ncols), 
		y: 0.5*margin + r + 2*r*kvot(i,ncols),
		r: r-margin,
		className: 'res' + obj.res,
		mMax: m
	}));
	return layout;
};


function filterWithAverage() {
	//let filterProv = state.selection.prov.map( prov => state.selection.uppg.filter(uppg => (uppg.prov==prov)));
	//filterProv.map( item => item.reduce)
	let uppgData = []
	for (i in state.selection.prov) {
		let filterProv = state.selection.uppg.filter(uppg => (uppg.prov==state.selection.prov[i]));
		let idList = [...new Set(filterProv.map(x=>x.id))];
		//console.log(idList)
		for (j in idList) {
			let uppgAllaElever = filterProv.filter( uppg=> (uppg.id == idList[j]));
			let percentage = Math.round(50*uppgAllaElever.reduce( (tot,uppg) => tot+uppg.res,0)/uppgAllaElever.length);
			//console.log(uppgAllaElever[0].nr, percentage);
			uppgData.push({
				id: uppgAllaElever[0].id, 
				nr: uppgAllaElever[0].nr,
				prov: uppgAllaElever[0].prov,
				niva: uppgAllaElever[0].niva,
				formaga: uppgAllaElever[0].formaga,
				kriterie: uppgAllaElever[0].kriterie,
				res: 0,
				percentage: percentage
			});
		};
	};
	return uppgData;
};


function updateView() {
	state.selection.update();
	if (state.selection.listview) {
		updateList();
	} else {
		updateMatris();
	};
};

