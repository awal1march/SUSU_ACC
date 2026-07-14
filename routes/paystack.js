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
    console.log("VERIFY ROUTE STARTED ✅", req.params.ref);

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


        const userId = req.user.id;


        console.log("WALLET PAYMENT:",{

            userId,

            amount,

            ref

        });



        await client.query("BEGIN");



        // Check duplicate payment

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




        // Update wallet

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





        // Save transaction

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
            "wallet",
            "success"
        ]

        );




        await client.query("COMMIT");



        res.json({

            success:true,

            message:
            "Wallet funded successfully ✅",

            amount:amount

        });



    }


    catch(error){


        await client.query("ROLLBACK");


        console.log(
    "VERIFY ERROR ❌",
    error
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