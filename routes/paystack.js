// const router = require("express").Router();
// const axios = require("axios");
// const db = require("../db");
// const auth = require("../middleware/auth");

// // ===================== INIT PAYMENT =====================
// router.post("/init", auth, async (req, res) => {
//   try {
//     const { email, amount } = req.body;

//     const response = await axios.post(
//       "https://api.paystack.co/transaction/initialize",
//       {
//         email,
//         amount: Number(amount) * 100,
//         metadata: {
//           userId: req.user.id
//         }
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
//           "Content-Type": "application/json"
//         }
//       }
//     );

//     res.json(response.data.data);

//   } catch (err) {
//     console.log("INIT ERROR ❌", err.message);
//     res.status(500).json({ message: "Init failed ❌" });
//   }
// });


// // ===================== VERIFY PAYMENT =====================
// router.get("/verify/:ref", async (req, res) => {
//   try {
//     const ref = req.params.ref;

//     const response = await axios.get(
//       `https://api.paystack.co/transaction/verify/${ref}`,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`
//         }
//       }
//     );

//     const data = response.data.data;

//     // ❌ payment not successful
//     if (data.status !== "success") {
//       return res.status(400).json({ message: "Payment failed ❌" });
//     }

//     const amount = data.amount / 100;
//     const userId = data.metadata.userId;

//     // ===================== UPDATE WALLET =====================
//     await db.query(
//       "UPDATE users SET wallet = wallet + $1 WHERE id = $2",
//       [amount, userId]
//     );

//     // ===================== TRANSACTION LOG =====================
//     await db.query(
//       `INSERT INTO transactions (reference, user_id, amount, status)
//        VALUES ($1, $2, $3, $4)`,
//       [ref, userId, amount, "success"]
//     );

//     res.json({ message: "Wallet updated successfully ✅" });

//   } catch (err) {
//     console.log("PAYSTACK ERROR ❌", err.message);
//     res.status(500).json({ message: "Verification failed ❌" });
//   }
// });

// module.exports = router;





// ===================== INIT PAYMENT =====================

const express = require("express");
const router = express.Router();
const axios = require("axios");
const db = require("../db");
const auth = require("../middleware/auth");


router.post("/init", auth, async(req,res)=>{

    try{

        console.log("INIT BODY:", req.body);


        const {
            email,
            amount,
            groupId,
            paymentType
        } = req.body;



        const userId = req.user.id;



        // Check payment type
        if(!paymentType){

            return res.status(400).json({

                message:"Payment type is required"

            });

        }



        // Contribution payment must have groupId
        if(paymentType === "contribution" && !groupId){

            return res.status(400).json({

                message:"Group ID is required for contribution payment"

            });

        }




        const response = await axios.post(

            "https://api.paystack.co/transaction/initialize",

            {

                email,

                amount:Number(amount) * 100,

                currency:"GHS",


                metadata:{


                    userId:String(userId),


                    groupId: groupId ? String(groupId) : null,


                    paymentType:paymentType


                }

            },


            {

                headers:{

                    Authorization:
                    `Bearer ${process.env.PAYSTACK_SECRET}`,


                    "Content-Type":"application/json"

                }

            }

        );



        res.json({

            reference:
            response.data.data.reference,


            authorization_url:
            response.data.data.authorization_url

        });



    }


    catch(error){


        console.log(

            "INIT ERROR:",
            error.message

        );


        res.status(500).json({

            message:"Payment initialization failed"

        });


    }

});

router.get("/verify/:ref", auth, async(req,res)=>{


const client = await db.connect();


try{


const ref = req.params.ref;



// Verify payment with Paystack

const response = await axios.get(

`https://api.paystack.co/transaction/verify/${ref}`,

{

headers:{

Authorization:
`Bearer ${process.env.PAYSTACK_SECRET}`

}

}

);



const payment = response.data.data;



if(payment.status !== "success"){


return res.status(400).json({

success:false,

message:"Payment not successful"

});

}



const amount = payment.amount / 100;



// Get user from JWT

const userId = req.user.id;



// Get group from Paystack metadata

const paymentType = payment.metadata.paymentType;

const groupId = payment.metadata.groupId || null;


console.log(
"PAYMENT DATA:",
{
    userId,
    groupId,
    amount,
    paymentType,
    ref
}
);



await client.query("BEGIN");




// CHECK DUPLICATE PAYMENT

const existing = await client.query(

`
SELECT id
FROM transactions
WHERE reference=$1
`,

[ref]

);



if(existing.rows.length > 0){


await client.query("ROLLBACK");


return res.json({

success:true,

message:"Payment already processed"

});

}



// =========================
// 1. UPDATE USER WALLET
// =========================


await client.query(

`
UPDATE users

SET wallet =
COALESCE(wallet,0)+$1

WHERE id=$2

`,

[
amount,
userId
]

);




// =========================
// 2. SAVE TRANSACTION
// =========================


await client.query(

`
INSERT INTO transactions
(
user_id,
amount,
reference,
payment_type,
status
)

VALUES($1,$2,$3,$4,$5)

`,

[
userId,
amount,
ref,
"contribution",
"success"
]

);





// =========================
// 3. FIND GROUP MEMBER
// =========================

console.log("CHECK MEMBER:", {
    userId,
    groupId,
    typeOfGroupId: typeof groupId
});


const allMembers = await client.query(
`
SELECT *
FROM group_members
WHERE user_id=$1
`,
[userId]
);


console.log(
"USER GROUPS:",
allMembers.rows
);
// =========================
// 3. CHECK CONTRIBUTION PAYMENT
// =========================


let groupMemberId = null;


if(paymentType === "contribution"){


    if(!groupId){

        throw new Error(
            "Group ID missing for contribution"
        );

    }



    const member = await client.query(

    `
    SELECT id
    FROM group_members
    WHERE user_id=$1
    AND group_id=$2
    `,

    [
        userId,
        groupId
    ]

    );



    if(member.rows.length === 0){

        throw new Error(
            "User is not a member of this group"
        );

    }


    groupMemberId = member.rows[0].id;


}


if(member.rows.length === 0){


throw new Error(
"User is not a member of this group"
);


}



 groupMemberId =
member.rows[0].id;





// =========================
// 4. SAVE CONTRIBUTION
// =========================


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





await client.query("COMMIT");





res.json({

success:true,

message:
"Contribution paid successfully ✅",

amount:amount

});



}


catch(error){



await client.query("ROLLBACK");



console.log(

"VERIFY ERROR ❌",

error.message

);



res.status(500).json({

success:false,

message:"Verification failed",

error:error.message

});


}



finally{


client.release();


}


});



module.exports = router;