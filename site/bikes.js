/* Blue Ronin · motorcycle fuel reference.
   [model, tank litres, consumption L/100 km]. Tank sizes are manufacturer specs; consumption is the
   maker's published figure (WMTC where one exists) or a typical owner-reported average when the maker
   gives none. Real riding on twisty roads burns more: the app adds a riding-style and road factor on
   top, and every rider can calibrate from an actual fill-up. Values were compiled in November 2026;
   check the sticker in your manual if something looks off. */
(function (g) {
  const B = {
    "Yamaha": [
      ["YZF-R9", 14, 4.9], ["YZF-R7", 13, 4.3], ["YZF-R1", 17, 7.2], ["YZF-R3", 14, 3.8], ["YZF-R125", 11, 2.1],
      ["MT-07", 14, 4.3], ["MT-09", 14, 5.0], ["MT-09 SP", 14, 5.0], ["MT-10", 17, 7.4], ["MT-03", 14, 3.8], ["MT-125", 11, 2.1],
      ["XSR700", 14, 4.3], ["XSR900", 14, 5.0], ["XSR900 GP", 14, 5.0],
      ["Tracer 7", 17, 4.3], ["Tracer 9", 18, 5.0], ["Tracer 9 GT+", 18, 5.0], ["Ténéré 700", 16, 4.3], ["Ténéré 700 World Raid", 23, 4.4],
      ["TMAX 560", 15, 4.8], ["XMAX 300", 13, 3.0], ["XMAX 125", 13, 2.4], ["NMAX 125", 7.1, 2.2]
    ],
    "Honda": [
      ["CBR1000RR-R Fireblade", 16.1, 6.6], ["CBR650R", 15.4, 4.9], ["CBR500R", 17.1, 3.6], ["CB1000 Hornet", 17, 5.9],
      ["CB750 Hornet", 15.2, 4.3], ["CB650R", 15.4, 4.9], ["CB500 Hornet", 17.1, 3.6], ["CB125R", 10.1, 2.1],
      ["NC750X", 14.1, 3.5], ["XL750 Transalp", 16.9, 4.3], ["CRF1100L Africa Twin", 18.8, 4.9], ["CRF1100L Africa Twin Adventure Sports", 24.8, 5.0],
      ["NT1100", 20.4, 5.0], ["Gold Wing", 21.1, 5.6], ["Rebel 500", 11.2, 3.6], ["Rebel 1100", 13.6, 4.9],
      ["X-ADV", 13.2, 3.6], ["Forza 750", 13.2, 3.6], ["Forza 350", 11.7, 3.0], ["Forza 125", 11.7, 2.3], ["ADV350", 11.7, 3.0], ["PCX 125", 8.1, 2.1]
    ],
    "Kawasaki": [
      ["Ninja ZX-10R", 17, 6.8], ["Ninja ZX-6R", 17, 5.8], ["Ninja ZX-4RR", 15, 4.6], ["Ninja 1000SX", 19, 5.7], ["Ninja 650", 15, 4.3], ["Ninja 500", 14, 3.8],
      ["Z H2", 19, 7.3], ["Z900", 17, 5.6], ["Z900RS", 17, 5.7], ["Z650", 15, 4.3], ["Z650RS", 12, 4.3], ["Z500", 14, 3.8],
      ["Versys 1000 S", 21, 5.9], ["Versys 650", 21, 4.6], ["Eliminator 500", 13, 3.6], ["KLR 650", 23, 4.9]
    ],
    "Suzuki": [
      ["Hayabusa", 20, 6.7], ["GSX-R1000R", 16, 6.8], ["GSX-S1000", 19, 6.1], ["GSX-S1000GT", 19, 6.1], ["GSX-8S", 14, 4.2], ["GSX-8R", 14, 4.2],
      ["SV650", 13.8, 4.2], ["V-Strom 1050DE", 20, 5.3], ["V-Strom 800DE", 20, 4.6], ["V-Strom 650", 20, 4.4], ["Burgman 400", 13.5, 3.6]
    ],
    "BMW": [
      ["R 1300 GS", 19, 4.8], ["R 1300 GS Adventure", 30, 4.9], ["R 1250 GS", 20, 4.8], ["R 1250 GS Adventure", 30, 4.8], ["R 1300 RT", 24, 4.8], ["R 1250 RT", 25, 4.8],
      ["S 1000 RR", 16.5, 6.4], ["M 1000 RR", 16.5, 6.6], ["S 1000 R", 16.5, 6.2], ["S 1000 XR", 20, 6.2], ["M 1000 XR", 20, 6.4],
      ["F 900 R", 13, 4.6], ["F 900 XR", 15.5, 4.6], ["F 900 GS", 14.5, 4.6], ["F 800 GS", 15, 4.4], ["R 12 nineT", 16, 5.4], ["R 18", 16, 5.6],
      ["K 1600 GTL", 26.5, 6.8], ["G 310 R", 11, 3.3], ["G 310 GS", 11, 3.3], ["C 400 X", 12.8, 3.5]
    ],
    "KTM": [
      ["1390 Super Duke R", 17.5, 6.7], ["990 Duke", 14.8, 5.4], ["890 Duke R", 14, 5.0], ["390 Duke", 15, 3.4], ["125 Duke", 15, 2.4],
      ["1290 Super Adventure S", 23, 6.0], ["890 Adventure", 20, 4.6], ["790 Adventure", 20, 4.4], ["390 Adventure", 14.5, 3.4], ["RC 390", 13.7, 3.4]
    ],
    "Ducati": [
      ["Panigale V4 S", 17, 7.0], ["Panigale V2", 15, 5.6], ["Streetfighter V4 S", 16, 7.0], ["Streetfighter V2", 15, 5.6],
      ["Monster", 14, 5.3], ["Monster SP", 14, 5.3], ["Hypermotard 950", 14.5, 5.9], ["Multistrada V4 S", 22, 6.5], ["Multistrada V2", 20, 5.5],
      ["DesertX", 21, 5.6], ["Diavel V4", 20, 6.7], ["Scrambler Icon", 15, 5.2], ["Scrambler Full Throttle", 15, 5.2]
    ],
    "Triumph": [
      ["Speed Triple 1200 RS", 15.5, 6.4], ["Street Triple 765 RS", 15, 5.2], ["Street Triple 765 R", 15, 5.2], ["Trident 660", 14, 4.4], ["Daytona 660", 14, 4.6],
      ["Tiger 1200 GT Pro", 20, 5.6], ["Tiger 1200 Rally Explorer", 30, 5.6], ["Tiger 900 GT", 20, 4.9], ["Tiger 900 Rally Pro", 20, 4.9], ["Tiger Sport 660", 17.2, 4.4],
      ["Speed Twin 1200", 14.5, 5.0], ["Bonneville T120", 14.5, 4.9], ["Scrambler 1200", 15, 5.1], ["Speed 400", 13, 3.4], ["Scrambler 400 X", 13, 3.4], ["Rocket 3", 18, 6.8]
    ],
    "Aprilia": [
      ["RSV4 Factory", 17.9, 7.3], ["Tuono V4 Factory", 17.9, 7.0], ["RS 660", 15, 4.9], ["Tuono 660", 15, 4.9], ["Tuareg 660", 18, 4.4], ["RS 457", 13, 3.8]
    ],
    "Harley-Davidson": [
      ["Street Glide", 22.7, 5.6], ["Road Glide", 22.7, 5.6], ["Fat Boy 114", 18.9, 5.6], ["Low Rider S", 18.9, 5.6], ["Sportster S", 11.8, 5.1], ["Nightster", 11.7, 4.9], ["Pan America 1250 Special", 21.2, 5.4], ["X350", 13.5, 3.6]
    ],
    "Royal Enfield": [
      ["Interceptor 650", 13.7, 3.9], ["Continental GT 650", 12.5, 3.9], ["Super Meteor 650", 15.7, 4.3], ["Bear 650", 13.7, 4.0], ["Himalayan 450", 17, 3.4], ["Classic 350", 13, 2.8], ["Hunter 350", 13, 2.8]
    ],
    "Husqvarna": [["Norden 901", 19, 4.6], ["Svartpilen 401", 15, 3.4], ["Vitpilen 401", 15, 3.4], ["701 Enduro", 13, 4.6]],
    "CFMOTO": [["800MT", 19, 5.0], ["800NK", 15, 5.1], ["700CL-X", 13, 4.8], ["450SR", 14, 3.6], ["450MT", 17.5, 3.6], ["450NK", 14, 3.6]],
    "Benelli": [["TRK 702", 20, 4.6], ["TRK 502", 20, 4.4], ["Leoncino 500", 13.5, 4.3]],
    "MV Agusta": [["Brutale 1000 RS", 16, 7.3], ["Dragster 800", 16.5, 6.0], ["Enduro Veloce", 20, 5.5]],
    "Moto Guzzi": [["V85 TT", 23, 4.9], ["V100 Mandello", 17, 5.4], ["Stelvio", 21, 5.0]],
    "Kymco": [["AK 550", 15, 4.5], ["Xciting S 400", 12.5, 3.4], ["DT X360", 13, 3.3]],
    "SYM": [["Maxsym TL 508", 15, 4.3], ["Joymax Z+ 300", 12.5, 3.2], ["ADX 300", 13, 3.3]]
  };
  const list = [];
  Object.entries(B).forEach(([brand, arr]) => arr.forEach(([model, tank, cons]) => list.push({ id: (brand + "-" + model).toLowerCase().replace(/[^a-z0-9]+/g, "-"), brand, model, tank, cons })));
  g.BRB = { list, brands: Object.keys(B) };
})(typeof module !== "undefined" ? module.exports : window);
