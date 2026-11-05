const {DatabaseSync}=require('node:sqlite');
const {mkdirSync}=require('node:fs');
const path=require('node:path');
class Store{
 constructor(dir,name='fieldwork.db'){mkdirSync(dir,{recursive:true});this.db=new DatabaseSync(path.join(dir,name));this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(kind,id));');}
 parse(payload){try{return JSON.parse(payload)}catch{throw Error('A saved record is damaged. Preserve the database backup before recovery.');}}
 all(kind){return this.db.prepare('SELECT payload FROM records WHERE kind=? ORDER BY rowid DESC').all(kind).map(r=>this.parse(r.payload));}
 get(kind,id){const row=this.db.prepare('SELECT payload FROM records WHERE kind=? AND id=?').get(kind,id);return row?this.parse(row.payload):null;}
 put(kind,id,value){this.db.prepare('INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload').run(kind,id,JSON.stringify(value));return value;}
 remove(kind,id){this.db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind,id);}
 close(){this.db.close();}
}
module.exports={Store};
