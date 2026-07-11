require("dotenv").config();

const db = require("../db");


async function initDatabase() {
    // your CREATE TABLE code here

    try {

        console.log("Starting database initialization...");


        // USERS TABLE
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                phone VARCHAR(20) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE,
                password TEXT NOT NULL,
                wallet NUMERIC(12,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);


        // GROUPS TABLE
        await db.query(`
            CREATE TABLE IF NOT EXISTS groups (
                id SERIAL PRIMARY KEY,
                group_name VARCHAR(100) NOT NULL,
                contribution_amount NUMERIC(12,2) NOT NULL,
                cycle_length INTEGER NOT NULL,
                creator_id INTEGER NOT NULL,
                current_payout_position INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT fk_group_creator
                FOREIGN KEY (creator_id)
                REFERENCES users(id)
                ON DELETE CASCADE
            );
        `);



        // GROUP MEMBERS TABLE
        await db.query(`
            CREATE TABLE IF NOT EXISTS group_members (

                id SERIAL PRIMARY KEY,

                group_id INTEGER NOT NULL,

                user_id INTEGER NOT NULL,

                position INTEGER NOT NULL,

                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


                CONSTRAINT fk_member_group
                FOREIGN KEY(group_id)
                REFERENCES groups(id)
                ON DELETE CASCADE,


                CONSTRAINT fk_member_user
                FOREIGN KEY(user_id)
                REFERENCES users(id)
                ON DELETE CASCADE,


                UNIQUE(group_id,user_id),

                UNIQUE(group_id,position)

            );
        `);



        // CONTRIBUTIONS TABLE
        await db.query(`
            CREATE TABLE IF NOT EXISTS contributions (

                id SERIAL PRIMARY KEY,


                group_member_id INTEGER NOT NULL,


                amount NUMERIC(12,2) NOT NULL,


                payment_reference VARCHAR(255) UNIQUE,


                payment_status VARCHAR(30)
                DEFAULT 'pending',


                paid BOOLEAN DEFAULT FALSE,


                contribution_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


                CONSTRAINT fk_contribution_member

                FOREIGN KEY(group_member_id)

                REFERENCES group_members(id)

                ON DELETE CASCADE

            );
        `);



        // PAYOUTS TABLE
        await db.query(`
            CREATE TABLE IF NOT EXISTS payouts (

                id SERIAL PRIMARY KEY,


                group_id INTEGER NOT NULL,


                receiver_id INTEGER NOT NULL,


                amount NUMERIC(12,2) NOT NULL,


                payout_status VARCHAR(30)
                DEFAULT 'pending',


                payout_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


                CONSTRAINT fk_payout_group

                FOREIGN KEY(group_id)

                REFERENCES groups(id)

                ON DELETE CASCADE,


                CONSTRAINT fk_payout_receiver

                FOREIGN KEY(receiver_id)

                REFERENCES users(id)

                ON DELETE CASCADE

            );
        `);



        // WALLET TRANSACTION HISTORY
        await db.query(`
            CREATE TABLE IF NOT EXISTS wallet_transactions (

                id SERIAL PRIMARY KEY,


                user_id INTEGER NOT NULL,


                amount NUMERIC(12,2) NOT NULL,


                transaction_type VARCHAR(30)
                NOT NULL,


                reference VARCHAR(255),


                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


                CONSTRAINT fk_wallet_user

                FOREIGN KEY(user_id)

                REFERENCES users(id)

                ON DELETE CASCADE

            );
        `);



        // INDEXES FOR SPEED

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_group_members_user
            ON group_members(user_id);
        `);


        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_group_members_group
            ON group_members(group_id);
        `);


        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_contributions_member
            ON contributions(group_member_id);
        `);



        console.log("Database initialized successfully ✅");


} catch(error){

    console.error(
        "Database initialization failed ❌",
        error
    );

    throw error;

}

}


module.exports = initDatabase;