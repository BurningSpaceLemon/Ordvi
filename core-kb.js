/* Ordvi Common Core
 * Curated high-frequency concepts. Compact pivot format expands into the same
 * lexicon shape as lexicon.js, so custom/specific entries can override it.
 */
(() => {
  const languages = ["de","en","fr","it","ru","zh"];
  // [part of speech, de, en, fr, it, ru, zh]
  const concepts = [
    ["interjection","hallo","hello","bonjour","ciao","привет","你好"],
    ["interjection","tschüss","goodbye","au revoir","arrivederci","до свидания","再见"],
    ["phrase","bitte","please","s'il vous plaît","per favore","пожалуйста","请"],
    ["phrase","danke","thanks","merci","grazie","спасибо","谢谢"],
    ["adverb","ja","yes","oui","sì","да","是"],
    ["adverb","nein","no","non","no","нет","不"],
    ["phrase","entschuldigung","excuse me","excusez-moi","mi scusi","извините","不好意思"],
    ["adjective","leid","sorry","désolé","dispiaciuto","извините","抱歉"],
    ["adjective","willkommen","welcome","bienvenue","benvenuto","добро пожаловать","欢迎"],

    ["noun","person","person","personne","persona","человек","人"],
    ["noun","mann","man","homme","uomo","мужчина","男人"],
    ["noun","frau","woman","femme","donna","женщина","女人"],
    ["noun","kind","child","enfant","bambino","ребёнок","孩子"],
    ["noun","freund","friend","ami","amico","друг","朋友"],
    ["noun","familie","family","famille","famiglia","семья","家庭"],
    ["noun","mutter","mother","mère","madre","мать","母亲"],
    ["noun","vater","father","père","padre","отец","父亲"],
    ["noun","bruder","brother","frère","fratello","брат","兄弟"],
    ["noun","schwester","sister","sœur","sorella","сестра","姐妹"],
    ["noun","name","name","nom","nome","имя","名字"],

    ["noun","haus","house","maison","casa","дом","房子"],
    ["noun","zimmer","room","chambre","stanza","комната","房间"],
    ["noun","tür","door","porte","porta","дверь","门"],
    ["noun","fenster","window","fenêtre","finestra","окно","窗户"],
    ["noun","tisch","table","table","tavolo","стол","桌子"],
    ["noun","stuhl","chair","chaise","sedia","стул","椅子"],
    ["noun","bett","bed","lit","letto","кровать","床"],
    ["noun","badezimmer","bathroom","salle de bain","bagno","ванная","浴室"],
    ["noun","küche","kitchen","cuisine","cucina","кухня","厨房"],
    ["noun","straße","street","rue","strada","улица","街道"],
    ["noun","stadt","city","ville","città","город","城市"],
    ["noun","land","country","pays","paese","страна","国家"],
    ["noun","schule","school","école","scuola","школа","学校"],
    ["noun","arbeit","work","travail","lavoro","работа","工作"],
    ["noun","büro","office","bureau","ufficio","офис","办公室"],
    ["noun","geschäft","shop","magasin","negozio","магазин","商店"],
    ["noun","restaurant","restaurant","restaurant","ristorante","ресторан","餐厅"],
    ["noun","hotel","hotel","hôtel","hotel","отель","酒店"],
    ["noun","flughafen","airport","aéroport","aeroporto","аэропорт","机场"],
    ["noun","bahnhof","station","gare","stazione","вокзал","车站"],
    ["noun","auto","car","voiture","auto","машина","汽车"],
    ["noun","bus","bus","bus","autobus","автобус","公交车"],
    ["noun","zug","train","train","treno","поезд","火车"],
    ["noun","flugzeug","plane","avion","aereo","самолёт","飞机"],
    ["noun","fahrrad","bicycle","vélo","bicicletta","велосипед","自行车"],

    ["noun","zeit","time","temps","tempo","время","时间"],
    ["noun","tag","day","jour","giorno","день","天"],
    ["noun","woche","week","semaine","settimana","неделя","星期"],
    ["noun","monat","month","mois","mese","месяц","月"],
    ["noun","jahr","year","année","anno","год","年"],
    ["adverb","heute","today","aujourd'hui","oggi","сегодня","今天"],
    ["adverb","morgen","tomorrow","demain","domani","завтра","明天"],
    ["adverb","gestern","yesterday","hier","ieri","вчера","昨天"],
    ["noun","morgenzeit","morning","matin","mattina","утро","早上"],
    ["noun","abend","evening","soir","sera","вечер","晚上"],
    ["noun","nacht","night","nuit","notte","ночь","夜晚"],
    ["noun","stunde","hour","heure","ora","час","小时"],
    ["noun","minute","minute","minute","minuto","минута","分钟"],

    ["noun","wasser","water","eau","acqua","вода","水"],
    ["noun","kaffee","coffee","café","caffè","кофе","咖啡"],
    ["noun","tee","tea","thé","tè","чай","茶"],
    ["noun","brot","bread","pain","pane","хлеб","面包"],
    ["noun","milch","milk","lait","latte","молоко","牛奶"],
    ["noun","käse","cheese","fromage","formaggio","сыр","奶酪"],
    ["noun","fleisch","meat","viande","carne","мясо","肉"],
    ["noun","fisch","fish","poisson","pesce","рыба","鱼"],
    ["noun","obst","fruit","fruit","frutta","фрукты","水果"],
    ["noun","apfel","apple","pomme","mela","яблоко","苹果"],
    ["noun","gemüse","vegetables","légumes","verdura","овощи","蔬菜"],
    ["noun","frühstück","breakfast","petit-déjeuner","colazione","завтрак","早餐"],
    ["noun","mittagessen","lunch","déjeuner","pranzo","обед","午餐"],
    ["noun","abendessen","dinner","dîner","cena","ужин","晚餐"],

    ["verb","sein","be","être","essere","быть","是"],
    ["verb","haben","have","avoir","avere","иметь","有"],
    ["verb","gehen","go","aller","andare","идти","去"],
    ["verb","kommen","come","venir","venire","приходить","来"],
    ["verb","machen","do","faire","fare","делать","做"],
    ["verb","wollen","want","vouloir","volere","хотеть","想要"],
    ["verb","brauchen","need","avoir besoin","avere bisogno","нуждаться","需要"],
    ["verb","wissen","know","savoir","sapere","знать","知道"],
    ["verb","verstehen","understand","comprendre","capire","понимать","理解"],
    ["verb","sprechen","speak","parler","parlare","говорить","说"],
    ["verb","sagen","say","dire","dire","сказать","说"],
    ["verb","fragen","ask","demander","chiedere","спрашивать","问"],
    ["verb","antworten","answer","répondre","rispondere","отвечать","回答"],
    ["verb","sehen","see","voir","vedere","видеть","看见"],
    ["verb","hören","hear","entendre","sentire","слышать","听见"],
    ["verb","lesen","read","lire","leggere","читать","读"],
    ["verb","schreiben","write","écrire","scrivere","писать","写"],
    ["verb","essen","eat","manger","mangiare","есть","吃"],
    ["verb","trinken","drink","boire","bere","пить","喝"],
    ["verb","kaufen","buy","acheter","comprare","покупать","买"],
    ["verb","bezahlen","pay","payer","pagare","платить","支付"],
    ["verb","öffnen","open","ouvrir","aprire","открывать","打开"],
    ["verb","schließen","close","fermer","chiudere","закрывать","关闭"],
    ["verb","beginnen","start","commencer","iniziare","начинать","开始"],
    ["verb","stoppen","stop","arrêter","fermare","останавливать","停止"],
    ["verb","helfen","help","aider","aiutare","помогать","帮助"],
    ["verb","warten","wait","attendre","aspettare","ждать","等待"],
    ["verb","finden","find","trouver","trovare","находить","找到"],
    ["verb","geben","give","donner","dare","давать","给"],
    ["verb","nehmen","take","prendre","prendere","брать","拿"],
    ["verb","arbeiten","work","travailler","lavorare","работать","工作"],
    ["verb","leben","live","vivre","vivere","жить","生活"],

    ["adjective","gut","good","bon","buono","хороший","好"],
    ["adjective","schlecht","bad","mauvais","cattivo","плохой","坏"],
    ["adjective","groß","big","grand","grande","большой","大"],
    ["adjective","klein","small","petit","piccolo","маленький","小"],
    ["adjective","neu","new","nouveau","nuovo","новый","新"],
    ["adjective","alt","old","vieux","vecchio","старый","旧"],
    ["adjective","schnell","fast","rapide","veloce","быстрый","快"],
    ["adjective","langsam","slow","lent","lento","медленный","慢"],
    ["adjective","heiß","hot","chaud","caldo","горячий","热"],
    ["adjective","kalt","cold","froid","freddo","холодный","冷"],
    ["adjective","einfach","easy","facile","facile","лёгкий","简单"],
    ["adjective","schwierig","difficult","difficile","difficile","трудный","困难"],
    ["adjective","wichtig","important","important","importante","важный","重要"],
    ["adjective","möglich","possible","possible","possibile","возможный","可能"],
    ["adjective","bereit","ready","prêt","pronto","готовый","准备好"],
    ["adjective","schön","beautiful","beau","bello","красивый","漂亮"],
    ["adjective","teuer","expensive","cher","costoso","дорогой","贵"],
    ["adjective","günstig","cheap","bon marché","economico","дешёвый","便宜"],
    ["adjective","richtig","correct","correct","corretto","правильный","正确"],
    ["adjective","falsch","wrong","faux","sbagliato","неправильный","错误"],

    ["pronoun","wer","who","qui","chi","кто","谁"],
    ["pronoun","was","what","quoi","cosa","что","什么"],
    ["adverb","wo","where","où","dove","где","哪里"],
    ["adverb","wann","when","quand","quando","когда","什么时候"],
    ["adverb","warum","why","pourquoi","perché","почему","为什么"],
    ["adverb","wie","how","comment","come","как","怎么"],
    ["phrase","wie viel","how much","combien","quanto","сколько","多少"],

    ["adverb","hier","here","ici","qui","здесь","这里"],
    ["adverb","dort","there","là-bas","lì","там","那里"],
    ["adverb","links","left","à gauche","a sinistra","налево","左边"],
    ["adverb","rechts","right","à droite","a destra","направо","右边"],
    ["adverb","geradeaus","straight ahead","tout droit","dritto","прямо","直走"],

    ["number","null","zero","zéro","zero","ноль","零"],
    ["number","eins","one","un","uno","один","一"],
    ["number","zwei","two","deux","due","два","二"],
    ["number","drei","three","trois","tre","три","三"],
    ["number","vier","four","quatre","quattro","четыре","四"],
    ["number","fünf","five","cinq","cinque","пять","五"],
    ["number","sechs","six","six","sei","шесть","六"],
    ["number","sieben","seven","sept","sette","семь","七"],
    ["number","acht","eight","huit","otto","восемь","八"],
    ["number","neun","nine","neuf","nove","девять","九"],
    ["number","zehn","ten","dix","dieci","десять","十"],

    ["noun","montag","monday","lundi","lunedì","понедельник","星期一"],
    ["noun","dienstag","tuesday","mardi","martedì","вторник","星期二"],
    ["noun","mittwoch","wednesday","mercredi","mercoledì","среда","星期三"],
    ["noun","donnerstag","thursday","jeudi","giovedì","четверг","星期四"],
    ["noun","freitag","friday","vendredi","venerdì","пятница","星期五"],
    ["noun","samstag","saturday","samedi","sabato","суббота","星期六"],
    ["noun","sonntag","sunday","dimanche","domenica","воскресенье","星期日"]
  ];

  const result = [];
  for (const row of concepts) {
    const [pos, ...terms] = row;
    languages.forEach((lang, index) => {
      const key = terms[index];
      if (!key) return;
      const translations = {};
      languages.forEach((target, targetIndex) => {
        if (target === lang || !terms[targetIndex]) return;
        translations[target] = [{
          text: terms[targetIndex],
          pos,
          note: "Ordvi Common Core"
        }];
      });
      result.push({ key, lang, forms: [], translations });
    });
  }

  globalThis.ORDVI_CORE_KB = result;
  globalThis.ORDVI_CORE_CONCEPT_COUNT = concepts.length;
})();
