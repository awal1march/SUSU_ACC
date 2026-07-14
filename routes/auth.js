const router = require("express").Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");

// ===================== REGISTER =====================
// ===================== REGISTER =====================

router.post("/register", async (req, res) => {

  console.log(req.body);

const {name, phone, password} = req.body || {};


  try {


    const hash = await bcrypt.hash(password, 10);


    await db.query(

      `
      INSERT INTO users
      (
        name,
        phone,
        password,
        wallet
      )

      VALUES($1,$2,$3,$4)

      `,

      [
        name,
        phone,
        hash,
        0
      ]

    );


    res.json({

      message:"Registered successfully ✅"

    });


  }


  catch(err){


    console.log(
      "REGISTER ERROR ❌",
      err.message
    );


    if(err.code==="23505"){

      return res.status(400).json({

        message:"Phone number already exists ❌"

      });

    }


    res.status(500).json({

      message:"Registration failed ❌"

    });


  }

});





// ===================== LOGIN =====================


router.post("/login", async(req,res)=>{


console.log("LOGIN REQUEST RECEIVED ✅");


try{


const {
phone,
password
}=req.body;



console.log(
"LOGIN PHONE:",
phone
);



const result = await db.query(

"SELECT * FROM users WHERE phone=$1",

[phone]

);



console.log(
"DATABASE RESULT:",
result.rows
);



const user=result.rows[0];



if(!user){

return res.status(404).json({

message:"User not found ❌"

});

}



console.log(
"USER FOUND:",
user.name
);



const passwordMatch =
await bcrypt.compare(
password,
user.password
);



console.log(
"PASSWORD MATCH:",
passwordMatch
);



if(!passwordMatch){


return res.status(401).json({

message:"Incorrect password ❌"

});


}




const token = jwt.sign(

{
id:user.id,
phone:user.phone
},

process.env.JWT_SECRET,

{
expiresIn:"7d"
}

);




res.json({

token,

user_id:user.id,

name:user.name,

wallet:user.wallet || 0

});




}


catch(err){


console.log(
"LOGIN ERROR ❌",
err
);


res.status(500).json({

message:"Server error ❌"

});


}


});

router.get("/profile", auth, async (req, res) => {

    try {

        const result = await db.query(
            `SELECT id, name, phone, wallet
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json(result.rows[0]);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Server error"
        });

    }

});


module.exports = router;