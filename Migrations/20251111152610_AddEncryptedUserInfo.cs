using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace sstore.Migrations
{
    /// <inheritdoc />
    public partial class AddEncryptedUserInfo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EncryptedUserInfo",
                table: "Logs",
                type: "varchar(512)",
                maxLength: 512,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EncryptedUserInfo",
                table: "Logs");
        }
    }
}
