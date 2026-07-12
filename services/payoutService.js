const db = require("../db");


async function processPayout(groupId){

const client = await db.connect();


try{


await client.query("BEGIN");



// ================= GET GROUP =================


const groupResult = await client.query(

`
SELECT 
id,
randomized,
current_position,
max_members
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


const membersResult = await client.query(

`
SELECT COUNT(*)
FROM group_members
WHERE group_id=$1
`,

[groupId]

);


const totalMembers =
Number(membersResult.rows[0].count);



if(totalMembers === 0){

throw new Error(
"No members found"
);

}




// ================= CHECK ALL CONTRIBUTIONS PAID =================


const paidResult = await client.query(

`
SELECT COUNT(DISTINCT group_member_id)
FROM contributions
WHERE group_id=$1
AND paid=true
AND payment_status='success'
`,

[groupId]

);



const totalPaid =
Number(paidResult.rows[0].count);



console.log({

totalMembers,
totalPaid

});



if(totalMembers !== totalPaid){

throw new Error(
"Not all members have paid"
);

}






// ================= FIND RECEIVER =================


const receiverResult = await client.query(

`
SELECT 
user_id,
position
FROM group_members
WHERE group_id=$1
AND position=$2
`,

[
groupId,
group.current_position
]

);



const receiver =
receiverResult.rows[0];



if(!receiver){

throw new Error(
"Receiver not found"
);

}







// ================= CALCULATE TOTAL =================


const amountResult = await client.query(

`
SELECT SUM(amount) AS total
FROM contributions
WHERE group_id=$1
AND paid=true
AND payment_status='success'
`,

[groupId]

);



const payoutAmount =
Number(amountResult.rows[0].total);



if(!payoutAmount || payoutAmount <=0){

throw new Error(
"No payout amount available"
);

}




console.log(
"PAYOUT AMOUNT:",
payoutAmount
);








// ================= CHECK DUPLICATE PAYOUT =================


const existing = await client.query(

`
SELECT id
FROM payouts
WHERE group_id=$1
AND position=$2
`,

[
groupId,
receiver.position
]

);



if(existing.rows.length > 0){

throw new Error(
"Payout already processed for this position"
);

}







// ================= CREATE PAYOUT RECORD =================


await client.query(

`
INSERT INTO payouts
(
group_id,
user_id,
amount,
position,
status,
created_at
)

VALUES($1,$2,$3,$4,$5,NOW())

`,

[

groupId,

receiver.user_id,

payoutAmount,

receiver.position,

"pending"

]

);







// ================= COMPLETE CONTRIBUTIONS =================


await client.query(

`
UPDATE contributions
SET payment_status='completed'
WHERE group_id=$1
AND payment_status='success'
`,

[groupId]

);








// ================= MOVE TO NEXT RECEIVER =================


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
group.max_members
]

);







await client.query("COMMIT");



console.log(
"PAYOUT CREATED SUCCESSFULLY ✅"
);



return {


success:true,

receiver:

receiver.user_id,

amount:

payoutAmount,


message:
"Payout created. Awaiting transfer."

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

module.exports={
processPayout
};