 

console.log("APP JS LOADED ✅");


// ===================== API SWITCH =====================
//const API = "http://localhost:3000";
const API= "https://susu-acc.onrender.com"


// ===================== STATE =====================
let token = localStorage.getItem("token");
let currentUser = JSON.parse(localStorage.getItem("user")) || null;
let isLoggedIn = !!token;


// ===================== UI =====================
function show(msg) {

  const el = document.getElementById("out");

  if (el) {
    el.innerText = msg;
  }

}

// ===================== TAB SWITCH =====================
function showTab(tab){


const authPage =
document.getElementById("auth");


const groupsPage =
document.getElementById("groups");


const walletPage =
document.getElementById("wallet");



authPage.classList.add("hidden");

groupsPage.classList.add("hidden");

walletPage.classList.add("hidden");



document.getElementById(tab)
.classList.remove("hidden");



if(tab==="groups"){


const groupId =
localStorage.getItem("groupId");


if(groupId){

loadMembers(groupId);

loadGroupDetails();

checkAdmin(groupId);

}


}



if(tab==="wallet"){


const groupId =
localStorage.getItem("groupId");


if(groupId){

loadMembers(groupId);

loadCurrentReceiver(groupId);

}


}


}
// ===================== REGISTER =====================
async function register() {

try {


const res = await fetch(`${API}/auth/register`, {


method:"POST",


headers:{
"Content-Type":"application/json"
},


body:JSON.stringify({

name:document.getElementById("name").value,

phone:document.getElementById("phone").value,

password:document.getElementById("password").value

})


});



const data = await res.json();



if(!res.ok){

return show(data.message || "Registration failed ❌");

}



show("Registered successfully ✅");



}
catch(err){

console.log(err);

show("Network error ❌");

}

}



// ===================== LOGIN =====================
async function login(){

try{


const res = await fetch(`${API}/auth/login`,{


method:"POST",


headers:{
"Content-Type":"application/json"
},


body:JSON.stringify({

phone:
document.getElementById("lphone").value,


password:
document.getElementById("lpass").value

})


});



const data = await res.json();



console.log("LOGIN RESPONSE",data);



if(!res.ok){

return show(data.message || "Login failed ❌");

}



token=data.token;



currentUser={

id:data.user_id,

name:data.name,

wallet:data.wallet

};



localStorage.setItem(
"token",
token
);


localStorage.setItem(
"user",
JSON.stringify(currentUser)
);



           isLoggedIn = true;

localStorage.setItem(
"token",
token
);


show("Login successful ✅");

const groupId = localStorage.getItem("groupId");

if(groupId){

    checkAdmin(groupId);

}


setTimeout(()=>{

    showTab("wallet");

},500);



            }
            catch(err){

            console.log(
            "LOGIN ERROR",
            err
            );


            show(
            "Network error ❌"
            );

}


}

// ===================== BALANCE =====================
async function balance(){

  if(!token){
    return show("Login required ❌");
  }

  try{
console.log("TOKEN BEFORE BALANCE:", token);
console.log("Token variable:", token);
console.log("Token in localStorage:", localStorage.getItem("token"));
    const res = await fetch(
      `${API}/wallet/balance`,
      {
        method:"GET",

        headers:{
          "Authorization": "Bearer " + token
        }
      }
    );


    const data = await res.json();


    if(!res.ok){
      return show(data.message);
    }


    document.getElementById("bal").innerText =
    "GHS " + data.balance;


  }
  catch(err){

    console.log(err);

    show("Balance error ❌");

  }

}


// ===================== PAYSTACK PAYMENT =====================

// ================= WALLET DEPOSIT =================

async function depositWallet(){


if(!token)
return show("Login required ❌");



const email =
document.getElementById("email").value;


const amount =
document.getElementById("depositAmount").value;



if(!email || !amount){

return show("Fill payment details ❌");

}



try{


const response = await fetch(

`${API}/paystack/init`,

{

method:"POST",

headers:{


"Content-Type":"application/json",

"Authorization":
"Bearer "+token


},


body:JSON.stringify({

email,

amount,

paymentType:"wallet"

})


}

);



const payment =
await response.json();



if(!response.ok){

return show(payment.message);

}




const handler =
PaystackPop.setup({


key:
"pk_live_b99f70e00e05b7a053b2a0c053e6fafca414d645",


email,


amount:Number(amount)*100,


currency:"GHS",


ref:payment.reference,


callback:function(response){


fetch(

`${API}/paystack/verify/${response.reference}`

)

.then(res=>res.json())

.then(data=>{


show(data.message);

balance();


});


}


});


handler.openIframe();



}
catch(error){

console.log(error);

show("Deposit failed ❌");

}


}

// ================= PAY CONTRIBUTION =================


async function payContribution(){


const groupId =
localStorage.getItem("groupId");


if(!groupId){

return show("Join a group first ❌");

}



const amount =
document.getElementById("contributionAmount").value;



try{


const response = await fetch(

`${API}/groups/pay`,

{


method:"POST",


headers:{


"Content-Type":"application/json",


"Authorization":
"Bearer "+token


},


body:JSON.stringify({

groupId,

amount:Number(amount)

})


}

);



const data =
await response.json();



show(data.message);



if(response.ok){

balance();

loadMembers(groupId);

loadCurrentReceiver(groupId);

}



}
catch(error){

console.log("CONTRIBUTION ERROR:", error);

show(
"Contribution payment failed ❌ " + error.message
);

}

}

async function processPayout(){

const groupId = localStorage.getItem("groupId");


if(!groupId){

return show("No group selected ❌");

}


try{


const response = await fetch(
`${API}/groups/${groupId}/payout`,
{

method:"POST",

headers:{

"Authorization":
"Bearer " + localStorage.getItem("token")

}

});


const data = await response.json();



if(response.ok){

show(
"Payment completed successfully ✅"
);


loadMembers(groupId);

loadGroupDetails();


}
else{

show(data.message);

}



}
catch(error){

console.log(error);

show("Payout failed ❌");

}


}

async function checkAdmin(groupId){

    console.log("Checking admin for group:", groupId);

    try{

        const response = await fetch(
            `${API}/groups/${groupId}/is-admin`,
            {
                headers:{
                    "Authorization":
                    "Bearer " + localStorage.getItem("token")
                }
            }
        );


        const data = await response.json();

        console.log("ADMIN RESPONSE:", data);



        const randomBtn =
        document.getElementById("randomizeBtn");


        const payoutBtn =
        document.getElementById("payoutBtn");



        if(data.isAdmin){


            console.log("ADMIN CONFIRMED ✅");


            if(randomBtn){

                randomBtn.style.display="block";

            }


            if(payoutBtn){

                payoutBtn.style.display="block";

            }


        }

        else{


            console.log("NOT ADMIN ❌");


            if(randomBtn){

                randomBtn.style.display="none";

            }


            if(payoutBtn){

                payoutBtn.style.display="none";

            }


        }


    }
    catch(error){

        console.log(
        "ADMIN CHECK ERROR:",
        error
        );

    }

}
// ===================== LOGOUT =====================
function logout(){


token=null;

currentUser=null;

isLoggedIn=false;



localStorage.removeItem("token");

localStorage.removeItem("user");



show(
"Logged out"
);


showTab("auth");


}




// ===================== INIT =====================
// ===================== INIT =====================

document.addEventListener(
"DOMContentLoaded",
()=>{


const bind=(id,fn)=>{

const el=document.getElementById(id);

if(el){

el.onclick=fn;

}

};



bind(
"registerBtn",
register
);


bind(
"loginBtn",
login
);


bind(
"balanceBtn",
balance
);





bind(
"logoutBtn",
logout
);



bind(
"tabAuth",
()=>showTab("auth")
);


bind(
"tabWallet",
()=>showTab("wallet")
);



bind(
"createGroupBtn",
createGroup
);



bind(
"joinGroupBtn",
joinGroup
);

bind(
"loadGroupBtn",
loadGroupData
);

bind(
"randomizeBtn",
randomizeMembers
);

bind(
"payoutBtn",
processPayout
);

bind(
"depositBtn",
depositWallet
);


bind(
"contributionBtn",
payContribution
);


if(token){

isLoggedIn=true;

showTab("wallet");


const groupId = localStorage.getItem("groupId");

if(groupId){

    checkAdmin(groupId);

}


show("Welcome back ✅");

}
else{

showTab("auth");

}


});




// ===================== CREATE GROUP =====================

async function createGroup(){

    if(!currentUser){
        return show("Please login again ❌");
    }


    try{

        const response = await fetch(`${API}/groups/create`,{

            method:"POST",

            headers:{

                "Content-Type":"application/json",

                "Authorization":
                "Bearer " + localStorage.getItem("token")

            },

            body:JSON.stringify({

                groupName:
                document.getElementById("groupName").value,

                amount:
                Number(document.getElementById("groupAmount").value),

                maxMembers:
                Number(document.getElementById("maxMembers").value)

            })

        });


        const data = await response.json();


        console.log("CREATE GROUP RESPONSE:", data);



        if(!response.ok){

            return show(data.message || "Group creation failed ❌");

        }



        const groupId = data.group.id;



        localStorage.setItem(
            "groupId",
            groupId
        );



       document.getElementById("groupInfo").innerHTML = `

<h4>${data.message}</h4>

<hr>

<b>Group Name:</b> 
${data.group.group_name}

<br><br>

<b>Group ID:</b>
${data.group.id}

<br><br>

<b>Creator ID:</b>
${data.group.creator_id}

<br><br>

<b>Maximum Members:</b>
${data.group.max_members}

<br><br>

Share this Group ID with members to join.

`;



        loadMembers(groupId);

        loadCurrentReceiver(groupId);

        checkAdmin(groupId);
        loadGroupDetails();



    }
    catch(error){

        console.log(error);

        show("Create group failed ❌");

    }

}
// ===================== JOIN GROUP =====================

async function joinGroup(){


    if(!currentUser){

        return show("Please login again ❌");

    }



    try{


        const groupId =
        document.getElementById("joinGroupId").value;



        const response = await fetch(
`${API}/groups/join`,
{
    method:"POST",

    headers:{
        "Content-Type":"application/json",
        "Authorization":
        "Bearer " + localStorage.getItem("token")
    },

    body:JSON.stringify({
        groupId: groupId
    })
});

        const data =
        await response.json();



        console.log(data);


        show(data.message);



        if(response.ok){


            localStorage.setItem(
                "groupId",
                groupId
            );
                loadMembers(groupId);

                loadCurrentReceiver(groupId);

                checkAdmin(groupId);
                loadGroupDetails();


            


        }



    }
    catch(error){

        console.log(error);

        show("Join group failed ❌");

    }


}

// ===================== RANDOMIZE MEMBERS =====================

async function randomizeMembers(){


const groupId = localStorage.getItem("groupId");


if(!groupId){

return show("No group selected ❌");

}



try{


const response = await fetch(
`${API}/groups/${groupId}/randomize`,
{

method:"POST",

headers:{

"Authorization":
"Bearer "+localStorage.getItem("token")

}

});



const data = await response.json();



if(response.ok){


show(
"Members randomized successfully ✅"
);



loadMembers(groupId);



}
else{


show(data.message);


}



}
catch(error){


console.log(error);


show("Randomization error ❌");


}


}
async function loadCurrentReceiver(groupId){


console.log(
"Loading receiver:",
groupId
);


try{


const response =
await fetch(
`${API}/groups/${groupId}/current`
);



console.log(
"Receiver status:",
response.status
);



const data =
await response.json();



console.log(
"Receiver data:",
data
);



document.getElementById(
"receiverName"
).innerText =


data.name ?

`${data.name} (Position ${data.position})`

:

"No receiver found";



}

catch(error){

console.log(
"RECEIVER ERROR:",
error
);

}


}
async function loadMembers(groupId){

try{

const response = await fetch(
`${API}/groups/${groupId}/members`,
{
headers:{
"Authorization":
"Bearer " + localStorage.getItem("token")
}
}
);


const data = await response.json();

console.log("MEMBER DATA:",data);


const members = data.members;


const table = document.getElementById("membersBody");

table.innerHTML="";


members.forEach(member=>{

table.innerHTML += `
<tr>

<td>${member.position}</td>

<td>${member.name}</td>

<td>
Waiting for Randomization
</td>

<td>
<button
class="danger"
onclick="removeMember(${groupId}, ${member.user_id})">
🗑 Delete
</button>
</td>

</tr>
`;
});


}
catch(error){

console.log(error);

console.log("MEMBER DATA:", data);
}

}

async function loadGroupDetails(){


const groupId =
localStorage.getItem("groupId");


if(!groupId){

return show("No group selected");

}



const response = await fetch(

`${API}/groups/${groupId}/details`,

{

headers:{
"Authorization":
"Bearer "+localStorage.getItem("token")
}

}

);



const data = await response.json();



document.getElementById("groupInfo").innerHTML = `

<b>Group Name:</b>
${data.group_name}

<br><br>

<b>Group ID:</b>
${data.id}

<br><br>

<b>Creator ID:</b>
${data.creator_id}

<br><br>

<b>Randomized:</b>
${data.randomized}

`;

}
async function removeMember(groupId,userId){


const confirmDelete =
confirm(
"Remove this member from the group?"
);


if(!confirmDelete){

return;

}



try{


const response = await fetch(

`${API}/groups/${groupId}/member/${userId}`,

{

method:"DELETE",

headers:{

"Authorization":
"Bearer "+localStorage.getItem("token")

}

}

);



const data = await response.json();



show(data.message);



if(response.ok){

loadMembers(groupId);

}



}

catch(error){

console.log(error);

show("Remove member failed ❌");

}


}
