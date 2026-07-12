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


// ===================== INITIALIZE PAYMENT =====================

router.post("/init", auth, async (req, res) => {

    try {

        const {
            email,
            groupId
        } = req.body;


        // ================= VALIDATE INPUT =================

        // if(!email || !groupId){

        //     return res.status(400).json({

        //         message:"Email and group ID are required"

        //     });

        // }


        // ================= GET GROUP CONTRIBUTION AMOUNT =================

        const group = await db.query(

            `
            SELECT contribution_amount
            FROM groups
            WHERE id=$1
            `,

            [groupId]

        );


        if(group.rows.length === 0){

            return res.status(404).json({

                message:"Group not found"

            });

        }


        const amount =
        Number(group.rows[0].contribution_amount);



        if(amount <= 0){

            return res.status(400).json({

                message:"Invalid contribution amount"

            });

        }


        // ================= PAYSTACK INITIALIZATION =================

        const response = await axios.post(

            "https://api.paystack.co/transaction/initialize",

            {

                email,

                amount: amount * 100,

                metadata: {

                    userId: req.user.id,

                    groupId: groupId

                }

            },

            {

                headers: {

                    Authorization:
                    `Bearer ${process.env.PAYSTACK_SECRET}`,

                    "Content-Type":
                    "application/json"

                }

            }

        );


        console.log(
            "PAYSTACK REFERENCE:",
            response.data.data.reference
        );


        res.json({

            ...response.data.data,

            amount

        });


    }

    catch(err){

        console.log(
            "INIT ERROR ❌",
            err.response?.data || err.message
        );


        res.status(500).json({

            message:"Payment initialization failed"

        });

    }

});






// ===================== VERIFY PAYMENT =====================


router.get("/verify/:ref", auth, async(req,res)=>{


const client = await db.connect();


try{


const ref = req.params.ref;



const response = await axios.get(

`https://api.paystack.co/transaction/verify/${ref}`,

{

headers:{

Authorization:
`Bearer ${process.env.PAYSTACK_SECRET}`

}

}

);



const data=response.data.data;



if(data.status !== "success"){

return res.status(400).json({

message:"Payment not successful"

});

}




const amount =
data.amount / 100;



const {

userId,

groupId,

paymentType

}=data.metadata;




console.log(
"VERIFY DATA:",
{
userId,
groupId,
amount,
paymentType
}
);



await client.query("BEGIN");





// CHECK DUPLICATE

const duplicate =
await client.query(

`
SELECT *
FROM transactions
WHERE reference=$1
`,

[ref]

);



if(duplicate.rows.length > 0){


await client.query("ROLLBACK");


return res.json({

message:"Payment already verified"

});


}






// ================= WALLET DEPOSIT ONLY =================


if(paymentType === "wallet"){



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


}


// ================= CONTRIBUTION =================


// ================= SAVE CONTRIBUTION =================


// Find group member

const member = await client.query(

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



if(member.rows.length === 0){

    throw new Error(
        "User is not a member of this group"
    );

}



const groupMemberId = member.rows[0].id;



// Insert successful contribution

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





// SAVE TRANSACTION

await client.query(
`
INSERT INTO transactions
(user_id, amount, reference, payment_type, status)

VALUES($1,$2,$3,$4,$5)
`,
[
    userId,
    amount,
    ref,
    paymentType,
    "success"
]
);





await client.query("COMMIT");





res.json({

success:true,

message:

paymentType==="contribution"

?

"Contribution payment successful ✅"

:

"Wallet funded successfully ✅"


});




}

catch(error){


await client.query("ROLLBACK");


console.log(
"VERIFY ERROR ❌",
error.message
);



res.status(500).json({

message:"Verification failed",

error:error.message

});



}

finally{

client.release();

}


});



module.exports=router;