const db = require("../util/database");

exports.updateOrAddCard = async (req, res, next) => {
  var insertedNoteIds;
  var insertedData = [];

  for (var groupData of req.body["data"]) {
    await manageGroupData(insertedData, groupData, req.userId);

    insertedNoteIds = [];
    var cards = groupData["cards"];
    for (let i = 0; i < cards.length; i++) {
      await manageGroupCardData(cards[i], groupData);
      if (groupData["groupName"] == "All") {
        await manageNotesData(cards[i], req.userId, insertedNoteIds);
      }
    }
    let lastIndex = insertedData.length - 1;
    insertedData[lastIndex]["cards"].push({
      noteId: insertedNoteIds,
    });
  }

  // const data = [
  //   {
  //     id:1,
  //     group: "All",
  //     isVisible: 1,
  //     card: [
  //       { id: 1, notes: [{ id: 1, title: "", text: "", dateTime: "", isUpdated : 0,isdeleted:0 }],isDeleted:0 },
  //       { id: 2, notes: { title: "", text: "", dateTime: "" } },
  //       { id: 3, notes: { title: "", text: "", dateTime: "" } },
  //       { id: 4, notes: { title: "", text: "", dateTime: "" } },
  //     ],
  //     isDeleted : 0,
  //     isUpdated : 0,
  //   },
  // ];

  res.status(200).json({
    message: "Data Saved Successfully !!",
    data: insertedData,
  });
};

exports.getAllCards = async (req, res, next) => {
  var [groups] = await db.execute(
    `SELECT id,groupdata.name as groupName,groupdata.isVisible
       FROM groupdata
       WHERE userId = ?`,
    [req.userId]
  );

  for (var val of groups) {
    var [value] = await db.execute(
      `SELECT carddata.*
      from groupcarddata
      join carddata ON carddata.id = groupcarddata.cardId
      where groupcarddata.groupId = ?`,
      [val["id"]]
    );
    val["cards"] = value;
  }

  for (var val of groups) {
    for (var card of val["cards"]) {
      var [value] = await db.execute(
        "SELECT id,isoCode,countryCode,phone from phone where cardDataId = ?",
        [card["id"]]
      );
      card["phone"] = value;
    }
  }

  for (var val of groups) {
    for (var card of val["cards"]) {
      var [value] = await db.execute(
        "SELECT id,title,text,dateTime from notes where cardDataId = ? And userId = ?",
        [card["id"], req.userId]
      );
      card["notes"] = value;
    }
  }

  res.status(200).json({
    message: "Fetched card cards successfully !!",
    groupCards: groups,
  });
};

async function manageGroupCardData(card, groupData) {
  if (card["isDeleted"]) {
    await db.execute(
      `
          Delete from groupcarddata
          where groupId = ? And cardId = ?
      `,
      [groupData["id"], card["id"]]
    );
    //remove links
  } else {
    var [result] = await db.execute(
      `
          Select * from groupcarddata 
          where groupId = ? And cardId = ?
      `,
      [groupData["id"], card["id"]]
    );
    if (!result)
      await db.execute(
        `
          INSERT INTO groupcarddata
          (groupId,cardId)
          VALUES
          (?,?)
      `,
        [groupData["id"], card["id"]]
      );
  }
}

async function manageNotesData(card, userId, insertedNoteIds) {
  var notes = card["notes"];
  for (var note of notes) {
    if (note["id"] == null) {
      var [insertedData] = await db.execute(
        "Insert into notes (title,text,dateTime,cardDataId,userId) Values (?,?,?,?,?)",
        [note["title"], note["text"], note["dateTime"], card["id"], userId]
      );
      insertedNoteIds.push(insertedData.insertId);
    } else if (note["isDeleted"]) {
      await db.execute(
        "Delete from notes where id = ? And userId = ? And cardDataId = ?",
        [note["id"], userId, card["id"]]
      );
    } else if (note["isUpdated"]) {
      await db.execute(
        "Update notes set title = ?,text = ?,dateTime = ? where id = ? And userId = ? And cardDataId = ?",
        [
          note["title"],
          note["text"],
          note["dateTime"],
          note["id"],
          userId,
          card["id"],
        ]
      );
    }
  }
}

async function manageGroupData(insertedData, groupData, userId) {
  if (groupData["id"] == null) {
    let [result] = await db.execute(
      "Insert into groupdata (name,userId,isVisible) Values (?,?,?)",
      [groupData["groupName"], userId, groupData["isVisible"]]
    );

    insertedData.push({
      groupId: result.insertId,
      cards: [],
    });
  } else if (groupData["isDeleted"]) {
    await db.execute("Delete from groupdata where userId = ? And id = ?", [
      userId,
      groupData["id"],
    ]);
  } else if (groupData["isUpdated"]) {
    await db.execute(
      "Update groupdata set name = ?,isVisible = ? where id = ? And userId = ?",
      [groupData["groupName"], groupData["isVisible"], groupData["id"], userId]
    );
  }
}
