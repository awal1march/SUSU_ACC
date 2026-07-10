const db = require("../db");


async function processPayout(groupId){


const client = await db.connect();


try{


await client.query("BEGIN");



// ================= GET GROUP =================


const groupResult = await client.query(

`
SELECT *
FROM groups
WHERE id=$1
FOR UPDATE
`,

[groupId]

);



const group = groupResult.rows[0];


if(!group){

throw new Error("Group not found");

}




// ================= CHECK RANDOMIZATION =================


if(!group.randomized){

throw new Error(
"Members must be randomized first"
);

}




// ================= CHECK MEMBERS =================

// ================= CHECK ALL MEMBERS PAID =================


const membersResult = await db.query(

`
SELECT COUNT(*)
FROM group_members
WHERE group_id=$1
`,
[
groupId
]

);



const totalMembers =
Number(membersResult.rows[0].count);





const paidResult = await db.query(

`
SELECT COUNT(DISTINCT user_id)
FROM contributions
WHERE group_id=$1
AND status IN ('paid','completed')
`,
[groupId]

);


const totalPaid =
Number(paidResult.rows[0].count);





console.log(
"TOTAL MEMBERS:",
totalMembers,
"TOTAL PAID:",
totalPaid
);



if(totalMembers !== totalPaid){

throw new Error(
"Not all members have paid"
);

}


// ================= FIND RECEIVER =================


const receiverResult = await db.query(

`
SELECT user_id, position
FROM group_members
WHERE group_id=$1
AND position=$2
`,
[
groupId,
group.current_position
]

);


console.log(
"RECEIVER DATA:",
receiverResult.rows
);



const receiver =
receiverResult.rows[0];



if(!receiver){

throw new Error(
"Receiver not found"
);

}




// ================= CALCULATE PAYOUT =================


const totalResult = await db.query(

`
SELECT SUM(amount) AS total
FROM contributions
WHERE group_id=$1
AND status IN ('paid','completed')
`,
[groupId]

);


const payoutAmount =
Number(totalResult.rows[0].total || 0);


console.log(
"TOTAL PAYOUT AMOUNT:",
payoutAmount
);


if(payoutAmount <= 0){

    throw new Error(
        "No payout amount available"
    );

}


// ================= CHECK EXISTING PAYOUT =================


const existingPayout =
await client.query(

`
SELECT *
FROM payouts
WHERE group_id=$1
AND position=$2
AND cycle_number=$3

`,

[
groupId,
receiver.position
]

);



if(existingPayout.rows.length > 0){

throw new Error(
"Payout already completed for this position"
);

}





// ================= SAVE PAYOUT =================


await client.query(

`
INSERT INTO payouts
(
group_id,
user_id,
amount,
position,
created_at
)

VALUES($1,$2,$3,$4,NOW())

`,

[
groupId,
receiver.user_id,
payoutAmount,
receiver.position
]

);







// ================= ADD MONEY TO RECEIVER WALLET =================


await client.query(

`
UPDATE users
SET wallet = COALESCE(wallet,0)+$1
WHERE id=$2
`,

[
payoutAmount,
receiver.user_id
]

);

// ================= COMPLETE CURRENT CONTRIBUTIONS =================

await db.query(
`
UPDATE contributions
SET status='completed'
WHERE group_id=$1
AND status='paid'
`,
[
    groupId
]
);


// ================= MOVE TO NEXT SUSU CYCLE =================

// ================= MOVE TO NEXT RECEIVER =================

await db.query(
`
UPDATE groups
SET current_position =
CASE
    WHEN current_position >= $2
        THEN 1
    ELSE current_position + 1
END
WHERE id=$1
`,
[
    groupId,
    totalMembers
]
);cd 




// ================= CLOSE CURRENT CONTRIBUTIONS =================


await client.query(

`
UPDATE contributions
SET status='completed'
WHERE group_id=$1
AND status='paid'
`,

[groupId]

);







// ================= MOVE NEXT POSITION =================


await client.query(

`
UPDATE groups
SET current_position =
CASE
WHEN current_position >= $2
THEN 1
ELSE current_position + 1
END
WHERE id=$1

`,

[
groupId,
totalMembers
]

);





await client.query("COMMIT");

if(totalMembers === totalPaid){

    try{

        await processPayout(groupId);

        console.log(
        "Automatic payout completed ✅"
        );

    }
    catch(error){

        console.log(
        "Automatic payout failed:",
        error.message
        );

    }

}



console.log(
"PAYOUT COMPLETED ✅"
);



return {

success:true,

receiver:receiver.user_id,

amount:payoutAmount

};



}
catch(error){


await client.query("ROLLBACK");


console.log(
"PAYOUT ERROR ❌",
error.message
);


throw error;


}
finally{


client.release();


}



}



module.exports = {
processPayout
};