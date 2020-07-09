const express = require ('express');
const axios = require('axios');
const cheerio = require('cheerio');
const mongo = require('mongodb');
const app = express();
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://127.0.0.1:27017/mydb";
const baseUrl = "https://blog.risingstack.com";
const port =  4000;

app.all('/*', function(req,res,next){
  res.header('Access-Control-Allow-Origin','http://localhost:3000');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type');
  res.header('Access-Control-Allow-Credentials', true);
  next();
});

const getArticleData = async (numberOfPages) => {
  articleData = [];
  pageUrls = [];
  for(i=1;i<=numberOfPages;i++){
    pageUrls.push("https://blog.risingstack.com/page/"+i.toString())
  }
  console.log(pageUrls)
  await Promise.all(pageUrls.map(pageURL =>
    axios.get(pageURL).then(response => {
      const $ = cheerio.load(response.data)
      $('article').map((i,article)=> {
        articleData.push({
          "title":$(article).find('a').text(),
          "pathAPI":($(article).find('a').attr('href')).replace(/\//g,""),
          "originalURL": baseUrl + $(article).find('a').attr('href')
        })
      })
    }).catch((error)=>{
      console.error(error)
    })
  ))
  return articleData
}
const generateFilteredPages = async (articleData)=> {
  dbData = []
  await Promise.all(articleData.map(element =>
    axios.get(element.originalURL).then(response => {
      const $ = cheerio.load(response.data)
      $('img').remove()
      dbData.push({
        "pathAPI": element.pathAPI,
        "filteredHtml":$.html()
      })
    }).catch((error) => {
      console.error(error)
    })
  ))
  return dbData;
}
app.get("/api", (req,res,next) => {
  MongoClient.connect(url, function (err,db){
    if(err) throw err;
    var dbo = db.db("mydb");
    dbo.collection('ArticleData').deleteMany({}, function (err,obj){
      if (err) throw err;
      console.log(obj.result.n + "document(s) deleted");
      db.close();
    });
  });
  let page = req.query.page;
  getArticleData(page).then((dataResponse) => {
    res.send(dataResponse)
    generateFilteredPages(dataResponse).then((dbData)=> {
      MongoClient.connect(url, function(err,db){
        if(err) throw err;
        var dbo = db.db("mydb");
        dbo.collection("ArticleData").insertMany(dbData, function(err,res){
            if(err) throw err;

        console.log("Number of docs inserted:" + res.insertedCount);
        db.close();
      });
    });
  }).catch((error)=> {
    console.error(error);
  })
}).catch((error)=>{
  console.error(error)
});
});
app.get("/:path", (req,res)=> {
  console.log(req.params.path)
  MongoClient.connect(url, function (err,db){
    if(err) throw err;
    var dbo = db.db("mydb");
    var query = {"pathAPI":req.params.path}
    dbo.collection("ArticleData").findOne(query,(err,result)=>{
      if(err) throw err;
      console.log(result);
      try{
        res.send(result.filteredHtml)
      }catch(err){
        console.log(err)
      }
      db.close();
    });
  });
});
app.listen(port,()=> {
  console.log("App listening at localhost: "+ port);
});
