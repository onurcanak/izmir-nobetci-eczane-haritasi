async function drawMap() {

    let isMobile = window.innerWidth < 769
    console.log('window.innerWidth', window.innerWidth)
    console.log('isMobile', isMobile)

    var formatNumber = d3.format('.0f')
    var chartColor = /* "#43BBB1" */ "#f7f7f7"
    var pointColor = '#ff7f7f'

    //#region 1- access data

    let izmirDistrictsShapes = await d3.json("./data/izmir.geo.json")
    let dataset = await d3.json("https://openapi.izmir.bel.tr/api/ibb/nobetcieczaneler")
    let nufusDataset = await d3.csv("./data/izmir-ilce-nufus.csv")
    delete nufusDataset['columns']

    let smallAreaDistricts = ['Karşıyaka', 'Bayraklı', 'Konak', 'Gaziemir', 'Karabağlar', 'Narlıdere']
    let notAllowedDistricts = ['Akçaada', 'Mustafa Çelebi Adası', 'Pırnallı Ada', 'Yassıca Ada', 'Yılan Adası', 'İncirli Ada']

    console.log('dataset', dataset)
    d3.select('#dateText').text(dataset[0].Tarih.replace('T', ' '))

    izmirDistrictsShapes.features.forEach(district => {
        let districtName = district.properties.tags.name
        district['name'] = districtName
        if (districtName == 'Karşıyaka') district['name_abbr'] = 'Karş.'
        else if (districtName == 'Bayraklı') district['name_abbr'] = 'Bayr.'
        else if (districtName == 'Karabağlar') district['name_abbr'] = 'Kara.'
        else if (districtName == 'Gaziemir') district['name_abbr'] = 'Gazi.'
        else if (districtName == 'Konak') district['name_abbr'] = 'Kon.'
        else if (districtName == 'Narlıdere') district['name_abbr'] = 'Narl.'
        else district['name_abbr'] = districtName
    })

    // gösterilecek ve gösterilmeyecek ilçeler
    izmirDistrictsShapes = {
        ...izmirDistrictsShapes, features: izmirDistrictsShapes.features.filter(district =>
            !notAllowedDistricts.includes(district.name)
        )
    }

    console.log('izmirDistrictsShapes', izmirDistrictsShapes)

    //#endregion

    //#region 2- create chart dimensions

    let dimensions = {
        margin: {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10,
        }
    }

    //#endregion

    //#region 3- draw canvas

    const wrapper = d3.select('#wrapper')
        .append('svg')
        .attr('id', 'map-svg')
        .attr('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`)

    const bounds = wrapper.append('g')
        .attr('class', 'bounds')

    dimensions.boundedWidth = +wrapper.style('width').replace('px', '') -
        - dimensions.margin.left
        - dimensions.margin.right

    //#endregion

    //#region 4- create scales

    const districtNameAccessor = d => d.name

    const projection = d3.geoMercator()
        .fitWidth(dimensions.boundedWidth, izmirDistrictsShapes)

    const colorScale = d3.scaleLinear().range(["#fff", chartColor])

    const pathGenerator = d3.geoPath(projection)

    //#endregion

    //#region 5- draw data

    const districts = bounds.selectAll(".district")
        .data(izmirDistrictsShapes.features)
        .enter().append("path")
        .attr("class", "district")
        .attr("d", pathGenerator)
        .attr('district', districtNameAccessor)

    const points = bounds.selectAll(".point")
        .data(dataset)
        .enter().append("circle")
        .attr('class', 'point')
        .attr('cx', function (d) {
            let [lat, long] = projection([d.LokasyonY, d.LokasyonX])
            return lat
        })
        .attr('cy', function (d) {
            let [lat, long] = projection([d.LokasyonY, d.LokasyonX])
            return long
        })
        .attr('r', `${isMobile ? 1 : 3}`)
        .attr('fill', pointColor)
        .attr('stroke-width', .1)
        .attr('stroke', '#000')

    //#endregion

    //#region 6- draw peripherals

    // ilçe isimlerinin yazdırılması
    const districtTexts = bounds.selectAll(".district-text")
        .data(izmirDistrictsShapes.features)
        .enter().append('text')
        .attr('class', 'district-text')
        .attr("pointer-events", "none")
        .attr('x', function (d) {
            return pathGenerator.centroid(d)[0]
        })
        .attr('y', function (d) {
            return pathGenerator.centroid(d)[1]
        })
        .style('opacity', 1)
        .text(function (d) {
            return d.name
        })

    // drawing my position
    // navigator.geolocation.getCurrentPosition(myPosition => {
    //     let [lat, long] = projection([myPosition.coords.longitude, myPosition.coords.latitude])
    //     bounds.append('circle')
    //         .attr('class', 'my-position')
    //         .attr('cx', lat)
    //         .attr('cy', long)
    //         .attr('r', '0')
    //         .transition().duration(200)
    //         .attr('r', '5')
    //         .attr('fill', 'blue')
    // })

    //#endregion

    //#region 7- draw set up interaction

    let zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on('zoom', handleZoom)

    wrapper.call(zoom)
    points.on('click', handlePointClick)

    function handleZoom(e) {
        d3.select('.tooltip')
            .style('display', 'none')
        d3.select('svg g')
            .attr('transform', e.transform)

        let currentScale = e.transform.k
        districtTexts.style('opacity', Math.max(1 - (currentScale * .15), .1))
    }

    function handlePointClick(e, d) {
        d3.select('.tooltip-name').text(d.Adi)
        d3.select('.tooltip-address').text(d.Adres)
        d3.select('.tooltip-notes').text(d.BolgeAciklama == '' ? '-' : d.BolgeAciklama)
        d3.select('.tooltip-phone').text(d.Telefon)
        if (!isEmptyString(d.Telefon)) d3.select('.tooltip-phone').attr('href', `tel:+${d.Telefon}`)
        d3.select('.navigation a')
            .attr('target', '_blank')
            .attr('href', `http://maps.apple.com/?q=${d.LokasyonX},${d.LokasyonY}`)

        d3.select('.tooltip')
            .style('display', 'unset')
            .style("left", `${isMobile ? `${(window.innerWidth - 300) / 2}` : e.pageX - 150}px`)
            .style("top", e.pageY + 20 + "px")
    }

    //#endregion

    draw()
    if (isMobile) initialZoom()

    function draw() {

        //colorScale.domain([minMetric_color, maxMetric_color])

        bounds.selectAll(".district")
            .style('fill', function (d) { return chartColor })
            .style('opacity', function (d) {
                return 1
            })

        districtTexts.text(function (d) {
            if (!smallAreaDistricts.includes(d.name)) {
                return d.name_abbr
            }
        })
    }

    function initialZoom() {
        wrapper.transition().duration(1000).call(
            zoom.transform,
            d3.zoomIdentity.translate(-260, -4).scale(3)
        )
    }

    function isEmptyString(str) {
        return str == '' || str == '-' || str == ' '
    }
}

drawMap()
