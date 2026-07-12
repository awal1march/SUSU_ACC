const db = require("../db");

async function processPayout(groupId) {

    const client = await db.connect();

    try {

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

        if (groupResult.rows.length === 0) {
            throw new Error("Group not found");
        }

        const group = groupResult.rows[0];

        // ================= CHECK RANDOMIZATION =================

        if (!group.randomized) {
            throw new Error("Members must be randomized first");
        }

        // ================= CHECK MEMBER COUNT =================

        const membersResult = await client.query(
            `
            SELECT COUNT(*) AS total
            FROM group_members
            WHERE group_id=$1
            `,
            [groupId]
        );

        const totalMembers = Number(membersResult.rows[0].total);

        if (totalMembers === 0) {
            throw new Error("No members found");
        }

        // ================= CHECK CONTRIBUTIONS =================

        const paidResult = await client.query(
            `
            SELECT COUNT(DISTINCT group_member_id) AS total
            FROM contributions
            WHERE group_id=$1
            AND paid=true
            AND payment_status='success'
            `,
            [groupId]
        );

        const totalPaid = Number(paidResult.rows[0].total);

        if (totalPaid !== totalMembers) {
            throw new Error("Not all members have paid");
        }

        // ================= FIND CURRENT RECEIVER =================

        const receiverResult = await client.query(
            `
            SELECT
                gm.user_id,
                gm.position,
                u.name
            FROM group_members gm
            JOIN users u
            ON gm.user_id = u.id
            WHERE gm.group_id=$1
            AND gm.position=$2
            `,
            [
                groupId,
                group.current_position
            ]
        );

        if (receiverResult.rows.length === 0) {
            throw new Error("Receiver not found");
        }

        const receiver = receiverResult.rows[0];

        // ================= CALCULATE PAYOUT =================

        const amountResult = await client.query(
            `
            SELECT COALESCE(SUM(amount),0) AS total
            FROM contributions
            WHERE group_id=$1
            AND paid=true
            AND payment_status='success'
            `,
            [groupId]
        );

        const payoutAmount = Number(amountResult.rows[0].total);

        if (payoutAmount <= 0) {
            throw new Error("No payout amount available");
        }

        // ================= PREVENT DUPLICATE PAYOUT =================

        const duplicate = await client.query(
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

        if (duplicate.rows.length > 0) {
            throw new Error("Payout already processed for this position");
        }

        // ================= CREDIT RECEIVER WALLET =================

        await client.query(
            `
            UPDATE users
            SET wallet = COALESCE(wallet,0) + $1
            WHERE id=$2
            `,
            [
                payoutAmount,
                receiver.user_id
            ]
        );

        // ================= SAVE PAYOUT =================

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
                "completed"
            ]
        );

        // ================= CLEAR CONTRIBUTIONS =================

        await client.query(
            `
            DELETE FROM contributions
            WHERE group_id=$1
            `,
            [groupId]
        );

        // ================= NEXT RECEIVER =================

        const nextPosition =
            group.current_position >= group.max_members
                ? 1
                : group.current_position + 1;

        await client.query(
            `
            UPDATE groups
            SET current_position=$1
            WHERE id=$2
            `,
            [
                nextPosition,
                groupId
            ]
        );

        await client.query("COMMIT");

        return {
            success: true,
            receiver: receiver.name,
            amount: payoutAmount,
            nextPosition,
            message: `${receiver.name} received GH₵${payoutAmount} successfully.`
        };

    } catch (error) {

        await client.query("ROLLBACK");

        console.log("PAYOUT ERROR ❌", error.message);

        throw error;

    } finally {

        client.release();

    }

}

module.exports = {
    processPayout
};