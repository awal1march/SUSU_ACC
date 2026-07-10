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


const router = require("express").Router();
const axios = require("axios");
const db = require("../db");
const auth = require("../middleware/auth");


// ===================== INIT PAYMENT =====================

router.post("/init", auth, async (req, res) => {

    try {

        const {
            email,
            amount,
            groupId,
            paymentType
        } = req.body;


        const response = await axios.post(

            "https://api.paystack.co/transaction/initialize",

            {

                email,

                amount: Number(amount) * 100,


                metadata: {

                    userId: req.user.id,

                    groupId: groupId || null,

                    paymentType: paymentType || "wallet"

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


        res.json(response.data.data);


    } catch(err){


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

router.get("/verify/:ref", async(req,res)=>{


    const client = await db.connect();


    try {


        const ref = req.params.ref;


        console.log(
            "VERIFY REFERENCE:",
            ref
        );



        // VERIFY WITH PAYSTACK

        const response = await axios.get(

            `https://api.paystack.co/transaction/verify/${ref}`,

            {

                headers: {

                    Authorization:
                    `Bearer ${process.env.PAYSTACK_SECRET}`

                }

            }

        );



        const data = response.data.data;



        if(data.status !== "success"){


            return res.status(400).json({

                message:"Payment not successful"

            });

        }




        const amount = data.amount / 100;


        const userId =
        data.metadata.userId;


        const groupId =
        data.metadata.groupId;


        const paymentType =
        data.metadata.paymentType;



        console.log(
            "PAYMENT DATA:",
            {
                amount,
                userId,
                groupId,
                paymentType
            }
        );



        await client.query("BEGIN");




        // ================= CHECK DUPLICATE PAYMENT =================


        const existingPayment =
        await client.query(

        `
        SELECT *
        FROM transactions
        WHERE reference=$1
        `,

        [ref]

        );


        if(existingPayment.rows.length > 0){


            await client.query("ROLLBACK");


            return res.json({

                message:"Payment already verified"

            });


        }




        // ================= UPDATE WALLET =================


        await client.query(

        `
        UPDATE users
        SET wallet = COALESCE(wallet,0) + $1
        WHERE id=$2
        `,

        [
            amount,
            userId
        ]

        );





        // ================= SAVE TRANSACTION =================


        await client.query(

        `
        INSERT INTO transactions
        (
            reference,
            user_id,
            amount,
            status
        )

        VALUES($1,$2,$3,$4)

        `,

        [

            ref,

            userId,

            amount,

            "success"

        ]

        );







        // ================= SAVE CONTRIBUTION =================


        if(paymentType === "contribution"){



            await client.query(

            `
            INSERT INTO contributions
            (
                group_id,
                user_id,
                amount,
                payment_reference,
                status,
                paid_at
            )

            VALUES($1,$2,$3,$4,$5,NOW())

            `,

            [

                groupId,

                userId,

                amount,

                ref,

                "paid"

            ]

            );





            const members =
            await client.query(

            `
            SELECT COUNT(*)
            FROM group_members
            WHERE group_id=$1
            `,

            [
                groupId
            ]

            );





            const paidMembers =
            await client.query(

            `
            SELECT COUNT(DISTINCT user_id)
            FROM contributions
            WHERE group_id=$1
            AND status='paid'
            `,

            [
                groupId
            ]

            );





            const totalMembers =
            Number(members.rows[0].count);



            const totalPaid =
            Number(paidMembers.rows[0].count);




            console.log(
                "MEMBERS:",
                totalMembers,
                "PAID:",
                totalPaid
            );



            if(totalMembers === totalPaid){


                console.log(
                    "All members paid. Ready for payout ✅"
                );


                // processPayout(groupId);

            }


                    console.log("Payment type:", paymentType);
        }




        await client.query("COMMIT");



        res.json({

            success:true,

            message:

            paymentType === "contribution"

            ?

            "Contribution successful"

            :

            "Wallet updated successfully"


        });



    }catch(err){


        await client.query("ROLLBACK");


        console.log(
            "VERIFY ERROR ❌",
            err.response?.data || err.message
        );


        res.status(500).json({

            message:"Verification failed",

            error:err.message

        });


    }finally{


        client.release();

    }


});



module.exports = router;



