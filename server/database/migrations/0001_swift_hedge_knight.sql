ALTER TABLE "transactions" DROP CONSTRAINT "transactions_transfer_shape";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_shape" CHECK ((("transactions"."type" = 'transfer') = ("transactions"."transfer_group_id" IS NOT NULL))
          AND (("transactions"."type" = 'transfer') = ("transactions"."transfer_direction" IS NOT NULL)));