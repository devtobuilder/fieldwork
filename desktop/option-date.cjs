function optionDate(value){const text=String(value||'').trim(),season=text.match(/\b(winter|spring|summer|fall|autumn)\s+(20\d{2})\b/i);if(season){const month={winter:0,spring:3,summer:6,fall:8,autumn:8}[season[1].toLowerCase()];return Date.UTC(Number(season[2]),month,1);}return Date.parse(text);}
module.exports={optionDate};
