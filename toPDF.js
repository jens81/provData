const ipcRenderer = require('electron').ipcRenderer;
var d3 = require('d3');

const state = {folder: '', kurser: {}, kurs: {}, selection: {}};

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
	current: 0,
	//listview: false, // för lista istället för matris
	//unlockable: false,
	datasize: 'small',
	uppg: [], // filtrerade uppgifter {id: 0, nr: '', niva: '', formaga: '', res: 0} osv.
	nMax: 0,
	matris: [], // Ett element för varje niva/formaga {niva: '', formaga: '', uppgifter = [] } där uppgifter är filtrerat efter elev, prov och niva/formaga
	next: function() {
		this.current += 1;
	},
	reset: function() {
		this.current = 0;
	},
	update: function() {
		this.uppg = this.elev.uppg.filter( uppg => this.prov.includes(uppg.prov) );
		/*
		this.unlockable = ((this.prov.length==1)&&(this.elev.namn!='Alla elever'));
		if (this.unlockable) {
			d3.select('#lock').style('color', 'black');
			d3.select('#lock2').style('color', 'black');
		} else {
			d3.select('#lock').attr('class', 'icon-lock').style('color', 'gray');
			d3.select('#lock2').attr('class', 'icon-lock').style('color', 'gray');
		};
		*/
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
		/*
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
		*/
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
		/*
		tooltip.attr('classed', 'left')
		groupsEnter.on('mouseover', function(s){ 
			tooltiphtml = (state.selection.datasize=='small')? '<b>'+s.prov+'</b><br>'+s.kriterie : '<b>'+s.prov+'</b><br><b> '+s.nr+'</b> | '+s.kriterie; 
			tooltip.html(tooltiphtml); 
			return tooltip.style("visibility", "visible");});
		groupsEnter.on("mousemove", function(){return tooltip.style("top", (d3.event.pageY+10)+"px").style("left",(d3.event.pageX - 100)+"px");})
	    groupsEnter.on("mouseout", function(){return tooltip.style("visibility", "hidden");});
	    */
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
	/*
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
	*/
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



function updateTitle() {
	d3.select('#kurs-namn').text(state.kurs.namn);
	//d3.select('#prov-namn').text(state.selection.prov[0]);
	d3.select('#elev-namn').text(state.selection.elev.namn);
}





//----------------------------------------------
// The rendering algorithm
//----------------------------------------------
const stateList = {
	num: 0, 
	selection: [],
	generateList: function(kurs) {
		let provList = [...new Set(kurs.elever[0].uppg.map(x=>x.prov))];
		let provListor = [];
		provListor.push(provList);
		provList.forEach(x=> provListor.push([x]));
		console.log(provList)
		console.log(provListor)
		// Skapa en provLists - en lista av listor: provLists[0] = alla prov, provLists[1]= ['Trig'], osv.
		this.num = kurs.elever.length*provListor.length-1;
		let id=0;
		for (i in kurs.elever) {
			this.selection.push({
				id: id,
				elev: kurs.elever[i],
				prov: provList,
				filename: kurs.elever[i].namn + '/' + kurs.elever[i].namn + '-' + 'Alla prov' + '.pdf'
			});
			id++;
			for (let j=1; j<provListor.length; j++) {
				this.selection.push({
					id: id,
					elev: kurs.elever[i],
					prov: provListor[j],
					filename: kurs.elever[i].namn + '/' + kurs.elever[i].namn + '-' + provListor[j][0] + '.pdf'
				});
				id++;
			};
		};
	}
};

ipcRenderer.on('toPDF', function(event,kurs) {
	state.kurs = kurs;
	stateList.generateList(kurs);
	state.selection.reset();
	id = state.selection.current;
	state.selection.elev = stateList.selection[id].elev;
	state.selection.prov = stateList.selection[id].prov;
	state.selection.update();
	updateTitle();
	updateMatris();
	updateList();

	ipcRenderer.send('print', stateList.selection[id].filename);
});

ipcRenderer.on('next', function(event, arg) {
	if (state.selection.current<stateList.num) {
		state.selection.next();
		id = state.selection.current;
		state.selection.elev = stateList.selection[id].elev;
		state.selection.prov = stateList.selection[id].prov;
		state.selection.update();
		updateTitle();
		if (state.selection.prov.length>1) {
			d3.select('#prov-namn').text('Alla prov');
		} else {
			d3.select('#prov-namn').text(state.selection.prov[0]);
		};
		updateMatris();
		updateList();
		let percentage = 100*id/stateList.num;
		ipcRenderer.send('print', stateList.selection[id].filename, percentage);
	} else {
		ipcRenderer.send('finished', 'done');
	}
});









