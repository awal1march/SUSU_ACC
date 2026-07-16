const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const db = require("../db");

const { processPayout } = require("../services/payoutService");


// ================= CREATE GROUP =================

router.post("/create", authMiddleware, async(req,res)=>{


try{


const userId = req.user.id;


const {
groupName,
amount,
maxMembers
}=req.body;



const groupResult = await db.query(

`
INSERT INTO groups
(
group_name,
contribution_amount,
max_members,
creator_id,
current_position,
randomized
)

VALUES($1,$2,$3,$4,$5,$6)

RETURNING *

`,

[
groupName,
amount,
maxMembers,
userId,
1,
false
]

);



const group = groupResult.rows[0];



await db.query(

`
INSERT INTO group_members
(
group_id,
user_id,
position
)

VALUES($1,$2,$3)

`,

[
group.id,
userId,
1
]

);



res.json({

message:"Group created successfully ✅",

group

});



}
catch(error){

console.log(error);


res.status(500).json({

message:"Server error",

error:error.message

});


}


});



// ================= JOIN GROUP =================


router.post("/join", authMiddleware, async(req,res)=>{
    


try{


const userId=req.user.id;


const {
groupId
}=req.body;



const groupResult = await db.query(

`
SELECT *
FROM groups
WHERE id=$1

`,
[groupId]

);


if(groupResult.rows.length===0){

return res.status(404).json({

message:"Group not found ❌"

});

}

const group=groupResult.rows[0];


// Stop joining after randomization

if(group.randomized){

return res.status(400).json({

message:"Group membership locked ❌"

});

}


const memberCheck = await db.query(

`
SELECT *
FROM group_members
WHERE group_id=$1
AND user_id=$2

`,

[
groupId,
userId
]

);


if(memberCheck.rows.length>0){

return res.status(400).json({

message:"Already joined ❌"

});

}

const positionResult = await db.query(

`
SELECT COUNT(*)
FROM group_members
WHERE group_id=$1

`,
[groupId]

);

const nextPosition =
Number(positionResult.rows[0].count)+1;

if(nextPosition > group.max_members){

return res.status(400).json({

message:"Group full ❌"

});

}

await db.query(

`
INSERT INTO group_members
(
group_id,
user_id,
position
)

VALUES($1,$2,$3)

`,

[
groupId,
userId,
nextPosition
]

);



res.json({

message:"Joined successfully ✅",

position:nextPosition

});



}
catch(error){


console.log(error);


res.status(500).json({

message:"Server error",

error:error.message

});


}


});


// ================= MEMBERS =================


// ================= GROUP MEMBERS =================

// ================= GROUP MEMBERS =================

router.get("/:groupId/members", authMiddleware, async(req,res)=>{

try{

const {groupId}=req.params;


// Check if group exists
const groupResult = await db.query(
`
SELECT randomized
FROM groups
WHERE id=$1
`,
[groupId]
);


if(groupResult.rows.length===0){

return res.status(404).json({

message:"Group not found ❌"

});

}


// Get all members from database

const membersResult = await db.query(
`
SELECT

u.id AS user_id,
u.name,
u.phone,
gm.position

FROM group_members gm

JOIN users u
ON u.id = gm.user_id

WHERE gm.group_id=$1

ORDER BY gm.position ASC

`,
[groupId]
);

console.log("MEMBERS SENT TO FRONTEND:", {
    randomized: groupResult.rows[0].randomized,
    members: membersResult.rows
});

res.json({

randomized:
groupResult.rows[0].randomized,

members:
membersResult.rows

});


}
catch(error){

console.log(
"LOAD MEMBERS ERROR ❌",
error
);


res.status(500).json({

message:"Server error"

});

}

});

// ================= CURRENT RECEIVER =================


router.get("/:groupId/current",async(req,res)=>{


try{


const {groupId}=req.params;



const group = await db.query(

`
SELECT current_position
FROM groups
WHERE id=$1

`,
[groupId]

);



if(group.rows.length===0){

return res.status(404).json({

message:"Group not found"

});

}


const receiver = await db.query(

`
SELECT

users.name,

group_members.position


FROM group_members


JOIN users

ON users.id=group_members.user_id


WHERE group_members.group_id=$1

AND group_members.position=$2

`,

[
groupId,
group.rows[0].current_position
]

);



res.json(receiver.rows[0]);



}
catch(error){

console.log(error);


res.status(500).json({

message:"Server error"

});


}


});


// ================= RANDOMIZE MEMBERS =================


// ================= RANDOMIZE MEMBERS =================

router.post("/:groupId/randomize", authMiddleware, async(req,res)=>{

const {groupId}=req.params;
const userId=req.user.id;

const client = await db.connect();


try{

await client.query("BEGIN");


// GET GROUP

const groupResult = await client.query(
`
SELECT
creator_id,
randomized,
max_members
FROM groups
WHERE id=$1
FOR UPDATE
`,
[groupId]
);



if(groupResult.rows.length===0){

await client.query("ROLLBACK");

return res.status(404).json({
message:"Group not found ❌"
});

}


const group = groupResult.rows[0];



// CHECK ADMIN

if(Number(group.creator_id)!==Number(userId)){


await client.query("ROLLBACK");


return res.status(403).json({

message:"Only group admin can randomize ❌"

});

}



// CHECK ALREADY RANDOMIZED

if(group.randomized){


await client.query("ROLLBACK");


return res.status(400).json({

message:"Already randomized ❌"

});

}



// CHECK MEMBERS

const countResult = await client.query(
`
SELECT COUNT(*) AS total
FROM group_members
WHERE group_id=$1
`,
[groupId]
);



if(Number(countResult.rows[0].total)!==Number(group.max_members)){


await client.query("ROLLBACK");


return res.status(400).json({

message:"Group is not complete yet ❌"

});

}



// GET MEMBERS

const members = await client.query(
`
SELECT id
FROM group_members
WHERE group_id=$1
ORDER BY id
`,
[groupId]
);



let memberIds = members.rows.map(
member=>member.id
);



// SHUFFLE

// ================= SHUFFLE MEMBERS =================

for(let i = memberIds.length - 1; i > 0; i--){

    const j = Math.floor(
        Math.random() * (i + 1)
    );


    [
        memberIds[i],
        memberIds[j]
    ] =
    [
        memberIds[j],
        memberIds[i]
    ];

}




// TEMPORARY POSITIONS

for(let i=0;i<memberIds.length;i++){

await client.query(
`
UPDATE group_members
SET position=$1
WHERE id=$2
`,
[
1000+i,
memberIds[i]
]
);

}



// FINAL POSITIONS

for(let i=0;i<memberIds.length;i++){

await client.query(
`
UPDATE group_members
SET position=$1
WHERE id=$2
`,
[
i+1,
memberIds[i]
]
);

}



// UPDATE RANDOMIZED STATUS

await client.query(
`
UPDATE groups
SET 
randomized=true,
current_position=1
WHERE id=$1
`,
[groupId]
);


await client.query("COMMIT");



res.json({

success:true,

message:"Members randomized successfully ✅"

});


}
catch(error){


await client.query("ROLLBACK");


console.log(
"RANDOMIZATION ERROR ❌",
error
);


res.status(500).json({

message:"Server error",

error:error.message

});


}
finally{

client.release();

}


});

// ================= CHECK ADMIN =================

router.get("/:groupId/is-admin", authMiddleware, async (req, res) => {

    try {

        const { groupId } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            `
            SELECT creator_id
            FROM groups
            WHERE id = $1
            `,
            [groupId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Group not found"
            });
        }

        res.json({
            isAdmin: Number(result.rows[0].creator_id) === Number(userId)
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Server error"
        });

    }

});

router.get("/:groupId/details", authMiddleware, async(req,res)=>{

const {groupId}=req.params;


const result = await db.query(
`
SELECT 
id,
group_name,
max_members,
creator_id,
randomized
FROM groups
WHERE id=$1
`,
[groupId]
);


if(result.rows.length===0){

return res.status(404).json({
message:"Group not found"
});

}


res.json(result.rows[0]);

});
// ================= REMOVE MEMBER =================

router.delete("/:groupId/member/:userId", authMiddleware, async(req,res)=>{

    try{

        const {groupId,userId}=req.params;

        const adminId=req.user.id;


        // Check group owner
        const group = await db.query(
            `
            SELECT creator_id, randomized
            FROM groups
            WHERE id=$1
            `,
            [groupId]
        );


        if(group.rows.length===0){

            return res.status(404).json({
                message:"Group not found ❌"
            });

        }



        // Only admin can remove
        if(Number(group.rows[0].creator_id)!==Number(adminId)){

            return res.status(403).json({
                message:"Only group admin can remove members ❌"
            });

        }



        // Stop after randomization
        if(group.rows[0].randomized){

            return res.status(400).json({
                message:"Cannot remove members after randomization ❌"
            });

        }



        // Prevent admin deleting himself
        if(Number(userId)===Number(adminId)){

            return res.status(400).json({
                message:"Admin cannot remove himself ❌"
            });

        }



        await db.query(
            `
            DELETE FROM group_members
            WHERE group_id=$1
            AND user_id=$2
            `,
            [
                groupId,
                userId
            ]
        );



        res.json({

            message:"Member removed successfully ✅"

        });



    }
    catch(error){

        console.log(error);

        res.status(500).json({

            message:"Server error"

        });

    }

});

// ================= PAYOUT =================


router.post("/:groupId/payout", authMiddleware, async(req,res)=>{


try{


const {
groupId
}=req.params;


const userId=req.user.id;



const adminCheck = await db.query(

`
SELECT creator_id
FROM groups
WHERE id=$1
`,
[groupId]

);



if(adminCheck.rows.length===0){

return res.status(404).json({

message:"Group not found"

});

}




if(Number(adminCheck.rows[0].creator_id)!==
Number(userId)){


return res.status(403).json({

message:"Only admin can process payout"

});


}

const result =
await processPayout(groupId);

res.json({

success:true,

message:"Payout completed successfully",

result

});


}
catch(error){


console.log(error);


res.status(500).json({

message:"Payout failed"

});


}



});
// ================= PAY CONTRIBUTION FROM WALLET =================


// ================= PAY CONTRIBUTION FROM WALLET =================

// ================= PAY CONTRIBUTION FROM WALLET =================

router.post("/pay", authMiddleware, async(req,res)=>{

const client = await db.connect();

try{

const {groupId}=req.body;


if(!groupId){

return res.status(400).json({
message:"Group ID required ❌"
});

}


const userId=req.user.id;


await client.query("BEGIN");



// GET GROUP CONTRIBUTION AMOUNT

const groupResult = await client.query(
`
SELECT contribution_amount
FROM groups
WHERE id=$1
`,
[groupId]
);


if(groupResult.rows.length===0){

await client.query("ROLLBACK");

return res.status(404).json({
message:"Group not found ❌"
});

}


const amount =
Number(groupResult.rows[0].contribution_amount);




// FIND GROUP MEMBER

const memberResult = await client.query(
`
SELECT id
FROM group_members
WHERE group_id=$1
AND user_id=$2
`,
[
groupId,
userId
]
);



if(memberResult.rows.length===0){

await client.query("ROLLBACK");

return res.status(403).json({
message:"You are not a member of this group ❌"
});

}



const groupMemberId =
memberResult.rows[0].id;




// CHECK IF ALREADY PAID

const alreadyPaid = await client.query(
`
SELECT id
FROM contributions
WHERE group_member_id=$1
AND group_id=$2
AND paid=true
`,
[
groupMemberId,
groupId
]
);



if(alreadyPaid.rows.length>0){

await client.query("ROLLBACK");

return res.status(400).json({
message:"Contribution already paid ❌"
});

}




// CHECK WALLET

const walletResult = await client.query(
`
SELECT COALESCE(wallet,0) AS wallet
FROM users
WHERE id=$1
FOR UPDATE
`,
[userId]
);



const wallet =
Number(walletResult.rows[0].wallet);



if(wallet < amount){

await client.query("ROLLBACK");

return res.status(400).json({
message:"Insufficient wallet balance ❌"
});

}





// DEDUCT WALLET

await client.query(
`
UPDATE users
SET wallet = wallet - $1
WHERE id=$2
`,
[
amount,
userId
]
);





// SAVE CONTRIBUTION
// CHECK IF MEMBER ALREADY PAID

// CHECK DUPLICATE PAYMENT

const existingContribution = await client.query(

`
SELECT id
FROM contributions
WHERE group_member_id=$1
AND group_id=$2
AND paid=true
`,

[
groupMemberId,
groupId
]

);


if(existingContribution.rows.length > 0){

    throw new Error(
        "Contribution already paid"
    );

}



// INSERT CONTRIBUTION

if(paymentType === "contribution"){


await client.query(

`
INSERT INTO contributions
(
group_member_id,
group_id,
amount,
payment_reference,
payment_status,
paid,
contribution_date
)

VALUES($1,$2,$3,$4,$5,$6,NOW())

`,

[
groupMemberId,
groupId,
amount,
ref,
"success",
true
]

);


}



// CHECK ALL MEMBERS PAID

const members = await client.query(

`
SELECT COUNT(*)
FROM group_members
WHERE group_id=$1
`,

[groupId]

);



const paid = await client.query(

`
SELECT COUNT(*)
FROM contributions
WHERE group_id=$1
AND paid=true
`,

[groupId]

);



const totalMembers =
Number(members.rows[0].count);



const totalPaid =
Number(paid.rows[0].count);



let message =
"Contribution paid successfully ✅";



if(totalMembers === totalPaid){

message +=
" All members have paid. Ready for payout.";

}


await client.query("COMMIT");



res.json({

success:true,

message,

amount

});



}
catch(error){

await client.query("ROLLBACK");


console.log(
"PAY CONTRIBUTION ERROR ❌",
error
);


res.status(500).json({

message:"Payment failed",

error:error.message

});


}
finally{

client.release();

}


});
// ================= MY GROUPS =================

router.get("/my-groups", authMiddleware, async(req,res)=>{

try{

const userId = req.user.id;


const result = await db.query(
`
SELECT
g.id,
g.group_name,
g.max_members,
g.randomized

FROM groups g

JOIN group_members gm
ON g.id = gm.group_id

WHERE gm.user_id=$1

`,
[userId]
);


res.json({
groups: result.rows
});


}
catch(error){

console.log(error);

res.status(500).json({
message:"Failed to load groups"
});

}

});


module.exports=router;
